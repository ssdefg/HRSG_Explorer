"""HRSG_RAG_참고문헌/ 의 PDF를 페이지별로 추출·정제·청킹하여 rag/corpus.json 을 생성한다.

사용법:  python scripts/build_corpus.py
출력:    rag/corpus.json   [{id, doc_id, page, text}, ...]
         rag/doc_map.json  {doc_id: {file, status, reason|pages|chunks}}  (doc_id ↔ PDF 매핑, 제외 사유)
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

import pymupdf as fitz  # PyMuPDF (구 `import fitz`는 deprecated 경고가 뜸)

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "HRSG_RAG_참고문헌"
OUT_DIR = ROOT / "rag"

CHUNK_SIZE = 600
OVERLAP = 100
MIN_CHARS = 50  # 공백 제외 최소 글자 수
MIN_LETTER_RATIO = 0.4  # 한글/영문 비율 하한
LETTER_RE = re.compile(r"[A-Za-z가-힣ㄱ-ㆎ]")

# 코퍼스에서 제외할 문서 (파일명 → 사유). doc_id 번호는 전체 42편 정렬 순서 기준으로 고정.
EXCLUDE = {
    "ARO2023_Koya.pdf": "중복: admin,+ARO_11098_20230221_V2.pdf (REF-001)와 동일 파일(MD5 일치)",
    "JAKO200819463917983.pdf": "스캔 이미지 PDF: 텍스트 레이어 없음 (OCR 미적용)",
    "Kim2002_KSMEB.pdf": "스캔 이미지 PDF: 텍스트 레이어 없음 (OCR 미적용)",
}

# 단독 페이지 번호/쪽 표기: "12", "- 12 -", "Page 3", "3 of 10", "p. 4", "iv"
PAGE_NUM_RE = re.compile(
    r"^\s*(?:[-–—]?\s*\d{1,4}\s*[-–—]?|page\s*\d+(?:\s*(?:of|/)\s*\d+)?|\d+\s*(?:of|/)\s*\d+|p\.?\s*\d+|[ivxlcdm]{1,6})\s*$",
    re.IGNORECASE,
)
SENT_END_RE = re.compile(r"(?<=[.!?。])\s+|(?<=다\.)\s*|(?<=요\.)\s*")


def non_ws_len(s: str) -> int:
    return len(re.sub(r"\s", "", s))


def clean_block(text: str) -> str:
    """블록 내부 줄바꿈 정리: 하이픈 분철 복원, 줄바꿈→공백, 공백 정규화."""
    text = text.replace("­", "")  # soft hyphen
    text = re.sub(r"(?<=[a-z])-\n(?=[a-z])", "", text)  # exchan-\nger → exchanger
    text = re.sub(r"\s*\n\s*", " ", text)
    text = re.sub(r"[ \t ]+", " ", text)
    return text.strip()


def header_key(text: str) -> str:
    """머리말/꼬리말 반복 판정용 키 (숫자는 페이지마다 달라지므로 치환)."""
    return re.sub(r"\d+", "#", text.lower()).strip()


def extract_pages(pdf_path: Path) -> list[list[str]]:
    """페이지별 텍스트 블록(문단 후보) 목록."""
    pages = []
    with fitz.open(pdf_path) as doc:
        for page in doc:
            blocks = page.get_text("blocks", sort=True)
            paras = [clean_block(b[4]) for b in blocks if b[6] == 0]  # 0 = 텍스트 블록
            pages.append([p for p in paras if p])
    return pages


def drop_noise(pages: list[list[str]]) -> list[list[str]]:
    """페이지 번호와, 여러 페이지에 반복되는 짧은 머리말/꼬리말 제거."""
    n_pages = len(pages)
    counts = Counter()
    for paras in pages:
        counts.update({header_key(p) for p in paras if len(p) <= 150})
    threshold = max(3, int(n_pages * 0.3))
    repeated = {k for k, c in counts.items() if c >= threshold}

    cleaned = []
    for paras in pages:
        cleaned.append(
            [p for p in paras if not PAGE_NUM_RE.match(p) and header_key(p) not in repeated]
        )
    return cleaned


def split_long(text: str) -> list[str]:
    """CHUNK_SIZE 초과 문단을 오버랩 슬라이딩 윈도로 분할 (가능하면 문장/공백 경계에서 자름)."""
    pieces, start = [], 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        if end < len(text):
            window = text[start:end]
            cut = max(window.rfind(". "), window.rfind("다. "), window.rfind("? "))
            if cut < CHUNK_SIZE * 0.5:
                cut = window.rfind(" ")
            if cut > CHUNK_SIZE * 0.5:
                end = start + cut + 1
        pieces.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - OVERLAP, start + 1)
        # 오버랩 시작점을 단어 경계로 맞춤
        sp = text.find(" ", start, end)
        if sp != -1:
            start = sp + 1
    return pieces


def chunk_page(paras: list[str]) -> list[str]:
    """문단을 ~CHUNK_SIZE 단위로 묶고, 청크 사이에 OVERLAP 글자를 이어붙임."""
    units = []
    for p in paras:
        units.extend(split_long(p) if len(p) > CHUNK_SIZE else [p])

    chunks, buf = [], ""
    for u in units:
        if buf and len(buf) + 1 + len(u) > CHUNK_SIZE:
            chunks.append(buf)
            tail = buf[-OVERLAP:]
            sp = tail.find(" ")
            tail = tail[sp + 1 :] if sp != -1 else tail
            # 이미 split_long 이 오버랩을 넣은 조각이면 중복 오버랩 생략
            buf = u if u.startswith(tail[:20]) else (tail + " " + u).strip()
            if len(buf) > CHUNK_SIZE + OVERLAP:
                buf = u
        else:
            buf = f"{buf} {u}".strip() if buf else u
    if buf:
        chunks.append(buf)
    return [c for c in chunks if non_ws_len(c) >= MIN_CHARS and letter_ratio(c) >= MIN_LETTER_RATIO]


def letter_ratio(text: str) -> float:
    """한글/영문 알파벳 글자 수 ÷ 전체 길이. 낮으면 도표 라벨·수치·단위 나열로 간주."""
    return len(LETTER_RE.findall(text)) / len(text) if text else 0.0


def main() -> int:
    pdfs = sorted(SRC_DIR.glob("*.pdf"), key=lambda p: p.name.lower())
    if not pdfs:
        print(f"PDF 없음: {SRC_DIR}", file=sys.stderr)
        return 1

    corpus, doc_map, empty_docs = [], {}, []
    for i, pdf in enumerate(pdfs, 1):
        doc_id = f"REF-{i:03d}"
        if pdf.name in EXCLUDE:
            doc_map[doc_id] = {"file": pdf.name, "status": "excluded", "reason": EXCLUDE[pdf.name]}
            print(f"  {doc_id}  [제외] {pdf.name} — {EXCLUDE[pdf.name]}")
            continue
        doc_map[doc_id] = {"file": pdf.name, "status": "included"}
        try:
            pages = drop_noise(extract_pages(pdf))
        except Exception as e:  # 손상/암호화 PDF
            print(f"  [오류] {doc_id} {pdf.name}: {e}", file=sys.stderr)
            empty_docs.append(pdf.name)
            continue

        n_before = len(corpus)
        for page_no, paras in enumerate(pages, 1):
            for c_no, text in enumerate(chunk_page(paras), 1):
                corpus.append(
                    {"id": f"{doc_id}_p{page_no}_c{c_no}", "doc_id": doc_id, "page": page_no, "text": text}
                )
        n_chunks = len(corpus) - n_before
        doc_map[doc_id].update(pages=len(pages), chunks=n_chunks)
        print(f"  {doc_id}  {len(pages):4d}p  {n_chunks:5d} chunks  {pdf.name}")
        if n_chunks == 0:
            empty_docs.append(pdf.name)

    OUT_DIR.mkdir(exist_ok=True)
    (OUT_DIR / "corpus.json").write_text(json.dumps(corpus, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT_DIR / "doc_map.json").write_text(json.dumps(doc_map, ensure_ascii=False, indent=2), encoding="utf-8")

    n_included = sum(1 for v in doc_map.values() if v["status"] == "included")
    print(f"\n논문 편수: {n_included}편 (전체 {len(pdfs)}편 중 {len(pdfs) - n_included}편 제외)")
    print(f"총 추출 문단(청크) 수: {len(corpus)}개")
    print(f"저장: {OUT_DIR / 'corpus.json'}")
    if empty_docs:
        print(f"[경고] 텍스트를 추출하지 못한 문서 {len(empty_docs)}편 (스캔 이미지 PDF일 수 있음): {empty_docs}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
