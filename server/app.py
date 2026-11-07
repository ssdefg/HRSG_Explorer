"""HRSG 참고문헌 RAG API 서버 (FastAPI).

실행:  python -m uvicorn server.app:app --port 8000      (프로젝트 루트에서)
       npm run dev 의 Vite 개발 서버가 /api 요청을 이 서버로 프록시한다.

- HybridRetriever(BGE-M3 + BM25 인덱스)와 Gemini 클라이언트는 서버 시작 시 lifespan 에서
  한 번만 만들어 app.state 에 둔다. 요청 처리 중에는 절대 새로 만들지 않는다.
- GEMINI_API_KEY 가 없거나 호출이 실패해도 검색 결과(출처)는 그대로 돌려준다.

환경 변수 (프로젝트 루트 .env 에서도 읽음):
            GEMINI_API_KEY     Google AI Studio API 키
            RAG_MODEL          쉼표로 구분한 모델 목록, 앞에서부터 시도 (기본 gemini-3.5-flash,gemini-3.8-flash)
                               앞 모델이 과부하(503)·한도 초과(429)·미제공(404)이면 다음 모델로 넘어간다.
                               gemini-2.5-flash 는 신규 사용자에게 제공이 중단되었다.
"""

import json
import logging
import os
import re
import sys
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")
from rag.retriever import HybridRetriever  # noqa: E402

log = logging.getLogger("rag-server")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

MODELS = [m.strip() for m in os.environ.get("RAG_MODEL", "gemini-3.5-flash,gemini-3.8-flash").split(",") if m.strip()]
MODEL = MODELS[0]
MAX_OUTPUT_TOKENS = 8192
# 모델 하나당. SDK가 이 값을 X-Server-Timeout 헤더로 보내 Gemini 서버 측 마감이 되므로,
# 생성이 이보다 길어지면 504 DEADLINE_EXCEEDED 가 난다 (평상시 ~15s, 혼잡 시 30s 초과 관측).
# 두 모델을 다 시도해도(2 × 45s) 프론트엔드 askRag 타임아웃(120s)보다 짧게 유지한다.
LLM_TIMEOUT_MS = 45_000
LLM_RETRY_ATTEMPTS = 1  # SDK 자체 재시도 없음 — 과부하·시간 초과면 바로 다음 모델로 넘김
FALLBACK_CODES = {404, 429, 500, 502, 503, 504}
TOP_K = 8
# 안전 필터 등으로 답변이 막힌 경우
BLOCKED_FINISH = {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"}

# 가이드 §3.2 — 전화번호·이메일·발전소 고유 명칭 마스킹 (프론트엔드 src/lib/privacy.ts 와 같은 규칙, 서버 측 이중 방어)
MASK = "[마스킹]"
_MASK_RES = [
    re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    re.compile(r"(?<!\d)01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)"),
    re.compile(r"(?<!\d)0(?:2|[3-6][1-5]|70)[-.\s)]?\d{3,4}[-.\s]?\d{4}(?!\d)"),
    re.compile(r"\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)"),
]
_PLANT_RE = re.compile(r"([가-힣A-Za-z0-9]{1,15}?)(복합화력|화력|복합)?(발전소|발전본부|발전처|화력본부)")
_GENERIC = {"복합", "화력", "복합화력", "원자력", "수력", "양수", "태양광", "풍력", "열병합", "가스", "석탄", "LNG", "해당", "우리", "이", "그", "각",
            "국내", "해외", "전체", "대상", "기존", "신규", "일반", "모든", "여러", "전국"}


def mask_sensitive(text: str) -> str:
    for r in _MASK_RES:
        text = r.sub(MASK, text)
    def plant(m: re.Match) -> str:
        head = m.group(1) + (m.group(2) or "")
        return m.group(0) if m.group(1) in _GENERIC or head in _GENERIC else MASK
    return _PLANT_RE.sub(plant, text)


SYSTEM_PROMPT = """You are a technical assistant for combined-cycle power plant engineers working on HRSG (heat recovery steam generator) maintenance.
Answer the question using the numbered reference passages provided in the user's message. They are excerpts from HRSG papers, standards and technical reports.

- Base every factual statement on the passages and cite them inline with their numbers, e.g. [1] or [2][5].
- The message may include a block "[현재 화면 데이터]" with values from the HRSG Explorer app (mock data and example calculations, not literature).
  Use those values only to relate the literature to the user's current case, call them "앱 계산값" / "app values", never cite them with [n],
  and do not present them as measured or validated plant data.
- If the passages do not contain enough information to answer, say so plainly and state what is missing. Do not fill gaps from general knowledge without labelling it as such.
- Passages are text extracted from PDFs and may contain broken equations or table fragments; do not over-interpret them.
- Reply in the language of the question (Korean or English). Use short paragraphs; you may use "- " bullet lines, numbered steps and **bold** for key terms. No tables.
- Keep the answer focused: usually 3-8 sentences."""


@asynccontextmanager
async def lifespan(app: FastAPI):
    t0 = time.perf_counter()
    retriever = HybridRetriever()
    retriever.search("HRSG warm-up")  # 첫 질의의 지연(커널·캐시 초기화)을 시작 시점에 치름
    app.state.retriever = retriever
    app.state.search_lock = threading.Lock()  # 동시 요청 시 CPU 추론이 스레드끼리 코어를 다투지 않게 직렬화
    doc_map = json.loads((ROOT / "rag" / "doc_map.json").read_text(encoding="utf-8"))
    app.state.doc_files = {k: v["file"] for k, v in doc_map.items()}
    # 근거 카드용 서지 (scripts/build_bibliography.py) — 없으면 파일명만 표시
    bib_path = ROOT / "rag" / "bibliography.json"
    app.state.bibliography = json.loads(bib_path.read_text(encoding="utf-8")) if bib_path.exists() else {}
    if not app.state.bibliography:
        log.warning("rag/bibliography.json 없음 — 근거 카드에 논문 제목·DOI 대신 파일명만 표시합니다")
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    app.state.llm = (
        genai.Client(
            api_key=api_key,
            http_options=genai_types.HttpOptions(
                timeout=LLM_TIMEOUT_MS, retry_options=genai_types.HttpRetryOptions(attempts=LLM_RETRY_ATTEMPTS)
            ),
        )
        if api_key
        else None
    )
    if app.state.llm is None:
        log.warning("GEMINI_API_KEY 미설정 — 검색 결과만 반환합니다")
    log.info("retriever ready: %d passages, device=%s, %.1fs", len(retriever.metadata), retriever.device, time.perf_counter() - t0)
    yield


app = FastAPI(title="HRSG RAG API", lifespan=lifespan)


class ContextItem(BaseModel):
    """화면 데이터 항목 하나 — 라벨·값·단위만 받는다 (자유 텍스트·원문 문서는 받지 않음)"""
    label: str = Field(min_length=1, max_length=80)
    value: float | str | None = None
    unit: str | None = Field(default=None, max_length=20)


class ContextSnapshot(BaseModel):
    """AI 어시스턴트가 첨부한 현재 화면 데이터 스냅샷 (프론트엔드 src/lib/aiContext.ts)"""
    page: Literal["dashboard", "calculator", "checklist", "validation"]
    title: str = Field(min_length=1, max_length=80)
    items: list[ContextItem] = Field(max_length=40)


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    lang: Literal["ko", "en"] = "ko"
    context: ContextSnapshot | None = None


PREVIEW_CHARS = 100


class Source(BaseModel):
    rank: int  # 답변 속 인용 번호 [rank]
    doc_id: str
    page: int
    text_preview: str
    rrf_score: float
    # 화면의 '문단 보기'·파일명 표시용
    id: str
    file: str
    text: str
    # 근거 카드: 서지 · 검색 방식 (dense/bm25 순위 — None 이면 그 검색의 후보 40개에 없었음)
    title: str | None = None
    doi: str | None = None
    citation: str | None = None
    dense_rank: int | None = None
    bm25_rank: int | None = None


def to_source(rank: int, hit: dict, files: dict[str, str], bib: dict[str, dict]) -> Source:
    text = hit["text"]
    preview = text if len(text) <= PREVIEW_CHARS else text[:PREVIEW_CHARS].rstrip() + "…"
    b = bib.get(hit["doc_id"], {})
    return Source(
        rank=rank, doc_id=hit["doc_id"], page=hit["page"], text_preview=preview,
        rrf_score=round(hit["rrf_score"], 4), id=hit["id"], file=files.get(hit["doc_id"], ""), text=text,
        title=b.get("title"), doi=b.get("doi"), citation=b.get("citation"),
        dense_rank=hit.get("dense_rank"), bm25_rank=hit.get("bm25_rank"),
    )


class AskResponse(BaseModel):
    answer: str | None
    llm_status: Literal["ok", "unavailable", "refusal", "error"]
    llm_message: str | None = None
    model: str | None = None
    sources: list[Source]
    retrieval_ms: float
    llm_ms: float | None = None


def build_context(hits: list[dict]) -> str:
    lines = ["[참고 문헌 컨텍스트]"]
    for n, h in enumerate(hits, 1):
        lines.append(f"[{n}] (출처: {h['doc_id']}, Page {h['page']}) {h['text']}")
    return "\n\n".join(lines)


def format_value(v: float | str | None) -> str:
    if v is None:
        return "—"
    if isinstance(v, float):
        return f"{v:,.6g}" if abs(v) < 1e6 else f"{v:,.0f}"
    return mask_sensitive(v)[:60]


def build_screen_context(ctx: ContextSnapshot | None) -> str:
    """검증된(스키마·길이 제한) 화면 스냅샷만 프롬프트에 넣는다. 문자열 값은 다시 마스킹한다."""
    if ctx is None or not ctx.items:
        return ""
    lines = [f"[현재 화면 데이터 — HRSG Explorer 앱 계산값, 문헌 아님] {mask_sensitive(ctx.title)}"]
    for it in ctx.items:
        unit = f" {it.unit}" if it.unit else ""
        lines.append(f"- {mask_sensitive(it.label)}: {format_value(it.value)}{unit}")
    return "\n".join(lines)


def call_llm(client: genai.Client | None, question: str, context: str, screen: str = "") -> tuple[str | None, str, str | None, str | None]:
    """Gemini 로 답변 생성 → (answer, llm_status, message, served_model). MODELS 순서대로 시도한다."""
    if client is None:
        return None, "unavailable", "Gemini API 키가 설정되지 않았습니다 (.env 의 GEMINI_API_KEY).", None
    config = genai_types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT, max_output_tokens=MAX_OUTPUT_TOKENS)
    contents = f"{context}\n\n{screen + chr(10) + chr(10) if screen else ''}[질문]\n{question}"
    last_error = "Gemini API 오류."
    for model in MODELS:
        try:
            response = client.models.generate_content(model=model, contents=contents, config=config)
            return parse_response(response, model)
        except genai_errors.APIError as e:
            log.warning("Gemini %s error %s: %s", model, e.code, str(e.message)[:200])
            if e.code in (400, 401, 403) and "key" in str(e.message).lower():
                return None, "unavailable", "Gemini API 키가 유효하지 않습니다 (GEMINI_API_KEY 확인).", None
            if e.code not in FALLBACK_CODES:
                return None, "error", f"Gemini API 오류 ({e.code}).", None
            last_error = (
                "Gemini API 요청 한도 초과 — 잠시 후 다시 시도하세요."
                if e.code == 429
                else f"Gemini 모델이 응답하지 않습니다 ({e.code}) — 잠시 후 다시 시도하세요."
            )
        except Exception as e:  # 타임아웃·네트워크 오류 등 (SDK 내부 HTTP 라이브러리 예외)
            log.warning("Gemini %s request failed: %r", model, e)
            last_error = "Gemini API에 연결할 수 없거나 응답 시간이 초과되었습니다."
    return None, "error", last_error, None


def parse_response(response: genai_types.GenerateContentResponse, model: str) -> tuple[str | None, str, str | None, str | None]:
    served = response.model_version or model
    feedback = response.prompt_feedback
    if feedback and feedback.block_reason:
        return None, "refusal", f"질문이 안전 정책으로 차단되었습니다 ({feedback.block_reason}).", served
    candidate = response.candidates[0] if response.candidates else None
    finish = candidate.finish_reason.name if candidate and candidate.finish_reason else None
    if finish in BLOCKED_FINISH:
        return None, "refusal", f"모델이 답변을 생성하지 않았습니다 ({finish}).", served
    text = (response.text or "").strip()
    if not text:
        return None, "error", f"모델이 빈 응답을 반환했습니다 ({finish}).", served
    if finish == "MAX_TOKENS":
        text += "\n\n(답변이 길이 제한으로 잘렸습니다.)"
    return text, "ok", None, served


def timed_search(request: Request, query: str) -> tuple[list[dict], float]:
    t0 = time.perf_counter()
    with request.app.state.search_lock:
        hits = request.app.state.retriever.search(query, top_k=TOP_K)
    return hits, (time.perf_counter() - t0) * 1000


# sync def → FastAPI 스레드풀에서 실행 (CPU 추론과 동기 Gemini 호출이 이벤트 루프를 막지 않음)
@app.post("/api/ask", response_model=AskResponse)
def ask(body: AskRequest, request: Request) -> AskResponse:
    question = mask_sensitive(body.question.strip())
    if not question:
        raise HTTPException(422, "빈 질문")
    # 검색은 질문 문장만으로 한다 — 화면 수치가 문헌 검색 순위를 흔들지 않게
    hits, retrieval_ms = timed_search(request, question)
    sources = [to_source(rank, h, request.app.state.doc_files, request.app.state.bibliography) for rank, h in enumerate(hits, 1)]

    t1 = time.perf_counter()
    screen = build_screen_context(body.context)
    answer, status, message, served = call_llm(request.app.state.llm, question, build_context(hits), screen)
    llm_ms = (time.perf_counter() - t1) * 1000
    log.info(
        "ask: retrieval %.0fms, llm %.0fms (%s)%s — %s",
        retrieval_ms, llm_ms, status, f" +context:{body.context.page}" if body.context else "", question[:60],
    )
    return AskResponse(
        answer=answer, llm_status=status, llm_message=message, model=served,
        sources=sources, retrieval_ms=round(retrieval_ms, 1), llm_ms=round(llm_ms, 1),
    )


@app.get("/api/search")
def search(q: str, request: Request) -> dict:
    """검색만 (LLM 호출 없음) — 지연 측정·디버깅용"""
    hits, retrieval_ms = timed_search(request, q)
    return {"retrieval_ms": round(retrieval_ms, 1), "hits": hits}


@app.get("/api/health")
@app.get("/api/health/")
def health(request: Request) -> dict:
    r = request.app.state.retriever
    return {"status": "ok", "passages": len(r.metadata), "docs": len(set(m["doc_id"] for m in r.metadata)), "device": r.device, "model": " → ".join(MODELS)}
