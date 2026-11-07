"""검색 정량 평가: BM25 단독(A) vs 하이브리드(B: BGE-M3 + BM25 + 가중 RRF + 문헌당 2개)의 Recall@8 · MRR.

사용법:  python eval/eval_retrieval.py [평가셋.json] [--include-test]      (기본 eval/mock_eval_dataset.json)

test 분할 보호: 기본은 dev 문항만 불러오고 test 문항은 검색도 하지 않는다 (점수가 화면에 나오지 않게).
test 는 설정을 확정한 뒤 --include-test 로 한 번만 측정한다 (hrsg_eval_set_v1/CLAUDE.md 규칙).
평가셋:  {"questions": [{id, query, lang, target_doc_ids, split, answerable}, ...]}

정답 판정 기준 (협업안 7쪽): 문헌 단위 — 상위 8개 문단 중 정답 문헌의 아무 문단이 있으면 맞힌 것으로 본다.
  Recall@8 = 상위 8개 안에 들어온 정답 문헌 수 / 그 질문의 정답 문헌 수
  MRR      = 1 / (첫 정답 문단의 순위), 상위 8개 안에 없으면 0
답이 없는 질문(answerable=false 또는 정답 문헌 없음)은 지표 계산에서 빼고, 상위 점수만 따로 기록한다.
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from rag.retriever import MAX_PER_DOC, HybridRetriever  # noqa: E402

K = 8


def diversify(indices: list[int], meta: list[dict], k: int = K) -> list[int]:
    """문헌당 최대 MAX_PER_DOC 개 — HybridRetriever.search 와 같은 규칙"""
    out, per_doc = [], defaultdict(int)
    for i in indices:
        d = meta[i]["doc_id"]
        if per_doc[d] < MAX_PER_DOC:
            per_doc[d] += 1
            out.append(i)
            if len(out) == k:
                break
    return out


def rrf_order(*rankings: list[int], k: int = 60) -> list[int]:
    score = defaultdict(float)
    for ranking in rankings:
        for rank, i in enumerate(ranking, 1):
            score[i] += 1.0 / (k + rank)
    return sorted(score, key=lambda i: -score[i])


def metrics(top_docs: list[str], gold: set[str]) -> tuple[float, float]:
    recall = len(set(top_docs) & gold) / len(gold)
    rr = next((1.0 / r for r, d in enumerate(top_docs, 1) if d in gold), 0.0)
    return recall, rr


def main() -> int:
    files = [a for a in sys.argv[1:] if not a.startswith("--")]
    include_test = "--include-test" in sys.argv
    path = Path(files[0]) if files else ROOT / "eval" / "mock_eval_dataset.json"
    questions = json.loads(path.read_text(encoding="utf-8"))["questions"]
    if not include_test:
        n_test = sum(1 for q in questions if q.get("split") == "test")
        questions = [q for q in questions if q.get("split") != "test"]
        if n_test:
            print(f"[dev 전용] test 분할 {n_test}문항은 불러오지 않았습니다. 설정 확정 뒤 --include-test 로 한 번만 측정하세요.")
    r = HybridRetriever()
    meta = r.metadata

    # 주 비교 (A, B) + 원인 분석용 변형
    methods = {
        "A  BM25 단독": lambda rk, q: rk["bm25_top"][:K],
        "B  하이브리드 (BGE-M3+BM25+가중RRF+문헌당2)": None,  # HybridRetriever.search 그대로
        "   튜닝 전 하이브리드 (RRF 1:1+문헌당2)": lambda rk, q: diversify(rrf_order(rk["dense_top"], rk["bm25_top"]), meta),
        "   BM25 + 문헌당2": lambda rk, q: diversify(rk["bm25_top"], meta),
        "   Dense 단독 + 문헌당2": lambda rk, q: diversify(rk["dense_top"], meta),
        "   RRF (필터 없음)": lambda rk, q: rrf_order(rk["dense_top"], rk["bm25_top"])[:K],
    }
    id_of = {m["id"]: i for i, m in enumerate(meta)}
    per_q = []  # (question, method, recall, rr, top_docs)
    unanswerable = []
    for q in questions:
        rk = r.rankings(q["query"])
        gold = set(q.get("target_doc_ids") or [])
        if not q.get("answerable", True) or not gold:
            top = r.search(q["query"], top_k=K)
            unanswerable.append((q, float(rk["dense_scores"][rk["dense_top"][0]]),
                                 float(rk["bm25_scores"][rk["bm25_top"][0]]) if rk["bm25_top"] else 0.0,
                                 [h["doc_id"] for h in top]))
            continue
        for name, fn in methods.items():
            idx = [id_of[h["id"]] for h in r.search(q["query"], top_k=K)] if fn is None else fn(rk, q)
            docs = [meta[i]["doc_id"] for i in idx]
            rec, rr = metrics(docs, gold)
            per_q.append((q, name, rec, rr, docs))

    groups = {
        "전체": lambda q: True,
        "한국어": lambda q: q["lang"] == "ko",
        "영어": lambda q: q["lang"] == "en",
        "dev": lambda q: q["split"] == "dev",
    }
    if include_test:
        groups["test"] = lambda q: q["split"] == "test"

    def agg(name: str, g) -> tuple[int, float, float]:
        rows = [(rec, rr) for q, m, rec, rr, _ in per_q if m == name and g(q)]
        n = len(rows)
        return n, sum(x for x, _ in rows) / n, sum(y for _, y in rows) / n

    main_a, main_b = list(methods)[:2]
    print(f"\n평가셋: {path.name}  ·  답이 있는 질문 {len({q['id'] for q, *_ in per_q})}개  ·  답이 없는 질문 {len(unanswerable)}개  ·  판정: 문헌 단위, 상위 {K}개\n")
    print(f"{'구분':<6} {'n':>3} | {'A Recall@8':>10} {'A MRR':>7} | {'B Recall@8':>10} {'B MRR':>7} | {'ΔRecall':>8} {'ΔMRR':>7}")
    print("-" * 78)
    for gname, g in groups.items():
        n, ra, ma = agg(main_a, g)
        _, rb, mb = agg(main_b, g)
        print(f"{gname:<6} {n:>3} | {ra:>10.3f} {ma:>7.3f} | {rb:>10.3f} {mb:>7.3f} | {rb - ra:>+8.3f} {mb - ma:>+7.3f}")

    print(f"\n[원인 분석] 방식별 Recall@8 / MRR")
    cols = ("전체", "한국어", "영어", "test" if include_test else "dev")
    print(f"{'방식':<40} " + "  ".join(f"{g:>13}" for g in cols))
    for name in methods:
        cells = []
        for gname in cols:
            _, rec, mrr = agg(name, groups[gname])
            cells.append(f"{rec:.3f}/{mrr:.3f}")
        print(f"{name:<40} " + "  ".join(f"{c:>13}" for c in cells))

    print("\n[질문별] Recall@8 (A → B), 정답 문헌을 하나도 못 찾은 경우 ✗")
    by_q = defaultdict(dict)
    for q, m, rec, rr, docs in per_q:
        by_q[q["id"]][m] = (rec, rr, docs, q)
    for qid, d in by_q.items():
        (ra, rra, _, q), (rb, rrb, docs_b, _) = d[main_a], d[main_b]
        flag = lambda x: "✗" if x == 0 else " "
        print(f"  {qid:<6} [{q['split']:<4}] A {ra:.2f}{flag(ra)} MRR {rra:.2f} → B {rb:.2f}{flag(rb)} MRR {rrb:.2f}  {q['query'][:46]}")
    zero = lambda name, lang: sum(1 for q, m, rec, *_ in per_q if m == name and q["lang"] == lang and rec == 0)
    for lang in ("ko", "en"):
        tot = sum(1 for q, m, *_ in per_q if m == main_a and q["lang"] == lang)
        print(f"  정답 문헌 0개 질문 ({lang}): A {zero(main_a, lang)}/{tot} → B {zero(main_b, lang)}/{tot}")

    if unanswerable:
        ans_top = [float(r.rankings(q["query"])["dense_scores"].max()) for q in {q["id"]: q for q, *_ in per_q}.values()]
        print(f"\n[답이 없는 질문] 상위 1위 점수 (비교: 답이 있는 질문의 Dense 1위 코사인 평균 {sum(ans_top) / len(ans_top):.3f}, 최소 {min(ans_top):.3f})")
        for q, cos, bm, docs in unanswerable:
            print(f"  {q['id']} Dense 1위 cos {cos:.3f} · BM25 1위 {bm:6.2f} · 결과 문헌 {docs[:4]}  {q['query']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
