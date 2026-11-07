"""BGE-M3 dense + BM25 sparse 하이브리드 검색 (가중 RRF 결합, 문서당 최대 2개 문단).

가중치는 eval/tune_dev.py 로 dev 분할에서만 정했다: 한국어(한글 포함) 질의는 BM25 의 어절 단위
토큰화가 순위에 잡음을 주므로 Dense 0.9 / BM25 0.1, 그 밖의 질의는 0.5 / 0.5 (기존 RRF 와 같은 순위).

사전 산출물(scripts/build_indices.py): rag/embeddings.npy, rag/metadata.json, rag/bm25_index.pkl
사용법:  python rag/retriever.py   # 샘플 질의 테스트
"""

import json
import pickle
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer

ROOT = Path(__file__).resolve().parent.parent
RAG_DIR = ROOT / "rag"
sys.path.insert(0, str(ROOT / "scripts"))
from build_indices import MAX_LENGTH, MODEL_NAME, tokenize  # noqa: E402  인덱싱과 동일 토큰화/모델

CANDIDATES = 40  # dense / sparse 각각 후보 수
RRF_K = 60
MAX_PER_DOC = 2
# (Dense, BM25) 가중치 — 언어별
WEIGHTS_KO = (0.9, 0.1)
WEIGHTS_DEFAULT = (0.5, 0.5)
HANGUL_RE = re.compile(r"[가-힣]")


def fusion_weights(query: str) -> tuple[float, float]:
    return WEIGHTS_KO if HANGUL_RE.search(query) else WEIGHTS_DEFAULT


class HybridRetriever:
    def __init__(self, rag_dir: Path = RAG_DIR):
        self.embeddings = np.load(rag_dir / "embeddings.npy")
        self.metadata = json.loads((rag_dir / "metadata.json").read_text(encoding="utf-8"))
        with open(rag_dir / "bm25_index.pkl", "rb") as f:
            self.bm25 = pickle.load(f)
        if not (len(self.embeddings) == len(self.metadata) == self.bm25.corpus_size):
            raise ValueError("embeddings / metadata / bm25 행 수가 일치하지 않음 — build_indices.py 재실행 필요")

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        self.model = AutoModel.from_pretrained(MODEL_NAME).to(self.device).eval()
        if self.device == "cuda":
            self.model.half()

    @torch.inference_mode()
    def _encode_query(self, query: str) -> np.ndarray:
        batch = self.tokenizer(query, truncation=True, max_length=MAX_LENGTH, return_tensors="pt").to(self.device)
        cls = self.model(**batch).last_hidden_state[:, 0]
        return torch.nn.functional.normalize(cls.float(), p=2, dim=-1)[0].cpu().numpy()

    @staticmethod
    def _top(scores: np.ndarray, n: int) -> np.ndarray:
        """점수 내림차순 상위 n개 인덱스."""
        n = min(n, len(scores))
        idx = np.argpartition(-scores, n - 1)[:n]
        return idx[np.argsort(-scores[idx])]

    def rankings(self, query: str) -> dict:
        """Dense / BM25 각각의 후보 순위와 전체 점수 (search 내부용, 검증 스크립트에서도 사용)."""
        dense_scores = self.embeddings @ self._encode_query(query)
        bm25_scores = self.bm25.get_scores(tokenize(query))
        return {
            "dense_scores": dense_scores,
            "dense_top": [int(i) for i in self._top(dense_scores, CANDIDATES)],
            "bm25_scores": bm25_scores,
            # 일치 토큰이 없는(점수 0 이하) 문단은 후보에서 제외
            "bm25_top": [int(i) for i in self._top(bm25_scores, CANDIDATES) if bm25_scores[i] > 0],
        }

    def search(self, query: str, top_k: int = 8) -> list[dict]:
        r = self.rankings(query)
        dense_top, bm25_top = r["dense_top"], r["bm25_top"]

        rrf = defaultdict(float)
        for w, ranking in zip(fusion_weights(query), (dense_top, bm25_top)):
            for rank, i in enumerate(ranking, 1):
                rrf[int(i)] += w / (RRF_K + rank)

        # 화면 표시용 — 각 문단이 어느 검색에서 몇 위였는지 (결합 점수·순서에는 영향 없음)
        dense_rank = {int(i): r for r, i in enumerate(dense_top, 1)}
        bm25_rank = {int(i): r for r, i in enumerate(bm25_top, 1)}

        results, per_doc = [], defaultdict(int)
        for i, score in sorted(rrf.items(), key=lambda kv: -kv[1]):
            meta = self.metadata[i]
            if per_doc[meta["doc_id"]] >= MAX_PER_DOC:
                continue
            per_doc[meta["doc_id"]] += 1
            results.append({**meta, "rrf_score": score, "dense_rank": dense_rank.get(i), "bm25_rank": bm25_rank.get(i)})
            if len(results) == top_k:
                break
        return results


if __name__ == "__main__":
    t0 = time.time()
    retriever = HybridRetriever()
    print(f"로드 완료: {len(retriever.metadata)}개 문단, device={retriever.device}, {time.time() - t0:.1f}s")

    for q in ["HRSG superheater temperature control", "배열회수보일러 과열기 제어"]:
        t0 = time.time()
        hits = retriever.search(q)
        print(f"\n=== {q}  ({time.time() - t0:.2f}s)  BM25 토큰: {tokenize(q)}")
        for rank, h in enumerate(hits, 1):
            snippet = h["text"][:100].replace("\n", " ")
            print(f"{rank:2d}. {h['doc_id']}  p{h['page']:<4} RRF={h['rrf_score']:.5f}  {snippet}")
