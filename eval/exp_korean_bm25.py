"""dev 실험: 한국어 질의의 BM25 입력 보완 — (1) 도메인 용어 영문 확장, (2) Kiwi 형태소 토큰화.

사용법:  python eval/exp_korean_bm25.py [평가셋.json]
운영 코드(rag/retriever.py, server/)는 바꾸지 않는다. Dense 는 원래 질의 그대로, BM25 입력만 바꾼다.
Kiwi BM25 는 코퍼스를 메모리에서 다시 색인할 뿐 rag/bm25_index.pkl 은 건드리지 않는다. test 분할은 보지 않는다.
"""

import json
import re
import sys
from pathlib import Path

import numpy as np
from rank_bm25 import BM25Okapi

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "eval"))
from rag.retriever import CANDIDATES, WEIGHTS_DEFAULT, WEIGHTS_KO, HybridRetriever  # noqa: E402
from scripts.build_indices import tokenize  # noqa: E402
from tune_dev import HANGUL, fuse  # noqa: E402

# 사용자 예시 5개
GLOSSARY_BASIC = {
    "감온기": "attemperator desuperheater",
    "과열기": "superheater",
    "차압": "differential pressure",
    "자연순환": "natural circulation",
    "열효율": "thermal efficiency",
}
# 일반 HRSG 용어집 (질의별 맞춤이 아니라 분야 기본 용어로 작성)
GLOSSARY_FULL = {
    **GLOSSARY_BASIC,
    "배열회수보일러": "HRSG heat recovery steam generator",
    "재열기": "reheater", "재열": "reheat", "증발기": "evaporator", "절탄기": "economizer",
    "드럼": "drum", "수위": "level", "3요소": "three element",
    "압력 손실": "pressure drop loss", "가스측": "gas side flue gas",
    "덕트 버너": "duct burner", "보조 연소": "supplementary firing afterburning",
    "핀치": "pinch point", "어프로치": "approach temperature",
    "복합화력": "combined cycle", "가스터빈": "gas turbine", "증기터빈": "steam turbine",
    "3압력": "triple pressure", "엑서지": "exergy",
    "유동가속부식": "flow accelerated corrosion FAC", "부식": "corrosion",
    "침적물": "deposit", "스케일": "scale deposit", "샘플링": "sampling",
    "수처리": "water treatment chemistry", "휘발성": "volatile AVT",
    "파울링": "fouling", "열전달": "heat transfer",
    "부분 부하": "part load off design", "관류": "once through",
    "복수기": "condenser", "지역난방": "district heating",
    "이산화탄소 포집": "CO2 capture carbon capture", "병렬 채널": "parallel channel",
    "불안정": "instability", "핀 튜브": "finned tube fin", "물성": "properties",
    "최적화": "optimization", "동특성": "dynamic", "질소산화물": "NOx emission",
}


def expand(query: str, glossary: dict) -> str:
    """질의에 한국어 용어가 있으면 영문 키워드를 덧붙인다 (띄어쓰기 차이는 무시)."""
    flat = query.replace(" ", "")
    extra = [en for ko, en in glossary.items() if ko.replace(" ", "") in flat]
    return " ".join([query, *extra])


class KiwiTokenizer:
    """영문은 기존 정규식, 한글은 Kiwi 형태소(체언·어근·용언 어간)."""
    KEEP = {"NNG", "NNP", "NR", "XR", "VV", "VA", "SH"}
    EN = re.compile(r"[a-z][a-z0-9]*")

    def __init__(self):
        from kiwipiepy import Kiwi
        self.kiwi = Kiwi()

    def __call__(self, text: str) -> list[str]:
        ko = [t.form for t in self.kiwi.tokenize(text) if t.tag in self.KEEP and HANGUL.search(t.form)]
        return self.EN.findall(text.lower()) + ko


def bm25_top(scores: np.ndarray) -> list[int]:
    idx = np.argsort(-scores)[:CANDIDATES]
    return [int(i) for i in idx if scores[i] > 0]


def score(rows, meta, weights_ko) -> tuple[float, float, float, float]:
    """(Recall@8, MRR) — 하이브리드 / BM25 단독"""
    out = np.zeros(4)
    for q, dense_top, bm_top, gold in rows:
        wd, wb = weights_ko if HANGUL.search(q["query"]) else WEIGHTS_DEFAULT
        for j, docs in enumerate((fuse({"dense_top": dense_top, "bm25_top": bm_top}, meta, wd, wb, CANDIDATES),
                                  fuse({"dense_top": [], "bm25_top": bm_top}, meta, 0, 1, CANDIDATES))):
            out[2 * j] += len(set(docs) & gold) / len(gold)
            out[2 * j + 1] += next((1.0 / r for r, d in enumerate(docs, 1) if d in gold), 0.0)
    return tuple(out / len(rows))


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "eval" / "mock_eval_dataset.json"
    questions = json.loads(path.read_text(encoding="utf-8"))["questions"]
    dev = [q for q in questions if q["split"] == "dev" and q.get("answerable", True) and q.get("target_doc_ids")]
    r = HybridRetriever()
    meta = r.metadata
    dense = {q["id"]: r.rankings(q["query"])["dense_top"] for q in dev}

    print("Kiwi 로 코퍼스 재색인 중 (메모리)…", flush=True)
    kiwi = KiwiTokenizer()
    bm25_kiwi = BM25Okapi([kiwi(m["text"]) for m in meta])

    variants = {
        "0  튜닝 후 B (확장 없음)": (r.bm25, tokenize, {}),
        "1a 용어 확장 · 기본 5개": (r.bm25, tokenize, GLOSSARY_BASIC),
        "1b 용어 확장 · 용어집": (r.bm25, tokenize, GLOSSARY_FULL),
        "2a Kiwi 토큰화": (bm25_kiwi, kiwi, {}),
        "2b Kiwi + 용어집 확장": (bm25_kiwi, kiwi, GLOSSARY_FULL),
    }
    WKO = [(0.9, 0.1), (0.8, 0.2), (0.7, 0.3), (0.5, 0.5)]
    print(f"\ndev 질문 {len(dev)}개 · 확장/토큰화는 한국어 질의의 BM25 입력에만 적용 · 셀 = Recall@8 / MRR\n")
    head = "  ".join(f"한국어 {wd}:{wb}".rjust(13) for wd, wb in WKO)
    print(f"{'방식':<26} {'dev 전체 (0.9:0.1)':>18}  {head}  {'한국어 BM25 단독':>15}")
    for name, (bm, tok, gl) in variants.items():
        rows = []
        for q in dev:
            text = expand(q["query"], gl) if HANGUL.search(q["query"]) else q["query"]
            rows.append((q, dense[q["id"]], bm25_top(bm.get_scores(tok(text))), set(q["target_doc_ids"])))
        ko = [x for x in rows if HANGUL.search(x[0]["query"])]
        allr = score(rows, meta, WEIGHTS_KO)
        cells = [score(ko, meta, w) for w in WKO]
        print(f"{name:<26} {allr[0]:>9.3f}/{allr[1]:.3f}  " + "  ".join(f"{c[0]:.3f}/{c[1]:.3f}".rjust(13) for c in cells)
              + f"  {cells[0][2]:>9.3f}/{cells[0][3]:.3f}")

    print("\n[확장 예시]")
    for q in dev:
        if HANGUL.search(q["query"]):
            print(f"  {q['id']}  {expand(q['query'], GLOSSARY_FULL)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
