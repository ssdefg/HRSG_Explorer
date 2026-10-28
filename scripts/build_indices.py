"""rag/corpus.json 으로 BGE-M3 dense 임베딩과 BM25 인덱스를 사전 생성한다.

사용법:  python scripts/build_indices.py            # 전체
         python scripts/build_indices.py --limit 32 # 앞 N개만 (동작 확인용, rag/ 에 저장하지 않음)
출력:    rag/embeddings.npy   float32 [N, 1024], L2 정규화 (내적 = 코사인 유사도)
         rag/metadata.json    임베딩 행 순서와 1:1 대응하는 {id, doc_id, page, text}
         rag/bm25_index.pkl   BM25Okapi (질의도 같은 tokenize() 로 토큰화할 것)
"""

import argparse
import json
import pickle
import re
import sys
import time
from pathlib import Path

import numpy as np
import torch
from rank_bm25 import BM25Okapi
from tqdm import tqdm
from transformers import AutoModel, AutoTokenizer

ROOT = Path(__file__).resolve().parent.parent
RAG_DIR = ROOT / "rag"
MODEL_NAME = "BAAI/bge-m3"
BATCH_SIZE = 16
MAX_LENGTH = 1024  # 청크 ≤700자라 실제로는 잘리지 않음

TOKEN_RE = re.compile(r"[a-z][a-z0-9]*|[가-힣]+")


def tokenize(text: str) -> list[str]:
    """BM25용 토큰화: 영문 소문자화 후 영문 단어(co2, h2o 처럼 숫자 포함 허용)와 한글 어절 추출."""
    return TOKEN_RE.findall(text.lower())


@torch.inference_mode()
def encode(texts: list[str], device: str) -> np.ndarray:
    """BGE-M3 dense 임베딩 = 마지막 층 [CLS] 벡터 → L2 정규화."""
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModel.from_pretrained(MODEL_NAME).to(device).eval()
    if device == "cuda":
        model.half()

    # 길이순으로 배치를 묶어 패딩 낭비를 줄이고, 결과는 원래 순서로 되돌림
    order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
    out = np.empty((len(texts), model.config.hidden_size), dtype=np.float32)
    for s in tqdm(range(0, len(order), BATCH_SIZE), desc="Encoding", unit="batch"):
        idx = order[s : s + BATCH_SIZE]
        batch = tokenizer(
            [texts[i] for i in idx], padding=True, truncation=True, max_length=MAX_LENGTH, return_tensors="pt"
        ).to(device)
        cls = model(**batch).last_hidden_state[:, 0]
        out[idx] = torch.nn.functional.normalize(cls.float(), p=2, dim=-1).cpu().numpy()
    return out


def human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, help="앞 N개 청크만 처리 (저장 안 함)")
    args = ap.parse_args()

    corpus = json.loads((RAG_DIR / "corpus.json").read_text(encoding="utf-8"))
    if args.limit:
        corpus = corpus[: args.limit]
    metadata = [{k: c[k] for k in ("id", "doc_id", "page", "text")} for c in corpus]
    texts = [c["text"] for c in metadata]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"청크 {len(texts)}개 | 모델 {MODEL_NAME} | device={device}")

    t0 = time.time()
    emb = encode(texts, device)
    print(f"임베딩 완료: {time.time() - t0:.0f}s")

    bm25 = BM25Okapi([tokenize(t) for t in texts])

    norms = np.linalg.norm(emb, axis=1)
    print(f"L2 norm 범위: {norms.min():.4f} ~ {norms.max():.4f}")
    if args.limit:
        print(f"[--limit] embeddings shape: {list(emb.shape)} (저장 생략)")
        return 0

    paths = {
        "embeddings": RAG_DIR / "embeddings.npy",
        "metadata": RAG_DIR / "metadata.json",
        "bm25": RAG_DIR / "bm25_index.pkl",
    }
    np.save(paths["embeddings"], emb)
    paths["metadata"].write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    with open(paths["bm25"], "wb") as f:
        pickle.dump(bm25, f)

    # 검증: 다시 읽어서 shape / 순서 일치 확인
    emb_chk = np.load(paths["embeddings"])
    with open(paths["bm25"], "rb") as f:
        bm25_chk = pickle.load(f)
    assert emb_chk.shape[0] == len(metadata) == bm25_chk.corpus_size, "행 수 불일치"
    assert emb_chk.dtype == np.float32

    print("\n[산출물]")
    for p in paths.values():
        print(f"  {p.relative_to(ROOT)}  {human(p.stat().st_size)}")
    print(f"  embeddings shape: {list(emb_chk.shape)}  dtype: {emb_chk.dtype}")
    print(f"  metadata 항목: {len(metadata)}  |  BM25 문서 수: {bm25_chk.corpus_size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
