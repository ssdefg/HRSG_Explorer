"""dev 분할만으로 하이브리드 결합 방식 튜닝 (가중 RRF, BM25 후보 수, 한국어 질의 BM25 가중치).

사용법:  python eval/tune_dev.py [평가셋.json]
test 분할은 여기서 보지 않는다. 최종 설정을 정한 뒤 eval_retrieval.py 로 test 를 한 번만 측정한다.
"""

import json
import re
import sys
from collections import defaultdict
from itertools import product
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from rag.retriever import MAX_PER_DOC, RRF_K, HybridRetriever  # noqa: E402

K = 8
HANGUL = re.compile(r"[가-힣]")


def fuse(rk: dict, meta: list[dict], w_dense: float, w_bm25: float, n_bm25: int) -> list[str]:
    score = defaultdict(float)
    for w, ranking in ((w_dense, rk["dense_top"]), (w_bm25, rk["bm25_top"][:n_bm25])):
        if w == 0:
            continue
        for rank, i in enumerate(ranking, 1):
            score[i] += w / (RRF_K + rank)
    docs, per_doc = [], defaultdict(int)
    for i in sorted(score, key=lambda i: -score[i]):
        d = meta[i]["doc_id"]
        if per_doc[d] < MAX_PER_DOC:
            per_doc[d] += 1
            docs.append(d)
            if len(docs) == K:
                break
    return docs


def evaluate(rows, cfg_for) -> tuple[float, float]:
    rec = mrr = 0.0
    for q, rk, gold in rows:
        docs = cfg_for(q)(rk)
        rec += len(set(docs) & gold) / len(gold)
        mrr += next((1.0 / r for r, d in enumerate(docs, 1) if d in gold), 0.0)
    return rec / len(rows), mrr / len(rows)


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "eval" / "mock_eval_dataset.json"
    questions = json.loads(path.read_text(encoding="utf-8"))["questions"]
    dev = [q for q in questions if q["split"] == "dev" and q.get("answerable", True) and q.get("target_doc_ids")]
    r = HybridRetriever()
    meta = r.metadata
    rows = [(q, r.rankings(q["query"]), set(q["target_doc_ids"])) for q in dev]
    ko = [x for x in rows if HANGUL.search(x[0]["query"])]
    en = [x for x in rows if not HANGUL.search(x[0]["query"])]
    print(f"dev 질문 {len(rows)}개 (한국어 {len(ko)}, 영어 {len(en)})\n")

    WEIGHTS = [1.0, 0.9, 0.8, 0.75, 0.7, 0.6, 0.5]  # Dense 가중치, BM25 = 1 - w
    NBM25 = [40, 20, 10]

    def cfg(wd, nb):
        return lambda q: (lambda rk: fuse(rk, meta, wd, round(1 - wd, 2), nb))

    print("[1] 공통 가중치 (Dense w / BM25 1-w) × BM25 후보 수 — dev Recall@8 / MRR")
    print(f"{'Dense w':>8} {'BM25 n':>7} | {'dev 전체':>13} {'dev 한국어':>13} {'dev 영어':>13}")
    for wd, nb in product(WEIGHTS, NBM25):
        if wd == 1.0 and nb != 40:
            continue  # BM25 가중치 0 이면 후보 수 무의미
        c = cfg(wd, nb)
        cells = [evaluate(s, c) for s in (rows, ko, en)]
        tag = "  ← 현재 B" if (wd, nb) == (0.5, 40) else ("  (Dense 단독)" if wd == 1.0 else "")
        print(f"{wd:>8.2f} {nb:>7} | " + " ".join(f"{a:.3f}/{b:.3f}".rjust(13) for a, b in cells) + tag)

    print("\n[2] 언어별 BM25 가중치 (BM25 후보 40, 한국어·영어 질의를 따로 최적화)")
    for name, subset in (("한국어", ko), ("영어", en)):
        print(f"  {name}: " + "  ".join(f"w_bm25={1 - wd:.2f}→{'/'.join(f'{v:.3f}' for v in evaluate(subset, cfg(wd, 40)))}" for wd in WEIGHTS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
