"""BGE-M3 dense 순위 계산 (로컬 모델만 사용, 외부 API 호출 없음).

passage 임베딩과 질문 임베딩을 .cache/ 에 저장해 재사용한다. 캐시 키 = 모델 + max_length + 입력 파일 내용의 sha256
이므로 모델, corpus, 질문 파일 중 하나라도 바뀌면 자동으로 다시 계산한다.

사용법 (작업 폴더 최상위에서):
    python App/tools/hybrid/embed_bge_m3.py --questions .cache/questions_dev.json
출력: .cache/dense_ranks_<키>.json  {질문 문자열: [passage 인덱스, dense 점수 내림차순 전체]}
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import torch
from tqdm import tqdm
from transformers import AutoModel, AutoTokenizer

MODEL_NAME = "BAAI/bge-m3"
MAX_LENGTH = 1024
BATCH_SIZE = 16
TOP_N = 0  # 0 = 전체 순위 (cap 뒤에도 k 개가 채워지도록 후보를 자르지 않음)

ROOT = Path(__file__).resolve().parents[3]
CACHE = ROOT / ".cache"


def sha(*parts: bytes) -> str:
    h = hashlib.sha256()
    for p in parts:
        h.update(p)
    return h.hexdigest()[:16]


@torch.inference_mode()
def encode(model, tok, texts: list[str], desc: str) -> np.ndarray:
    order = sorted(range(len(texts)), key=lambda i: -len(texts[i]))  # 길이순 배치로 패딩 최소화
    out = np.zeros((len(texts), 1024), dtype=np.float32)
    for s in tqdm(range(0, len(order), BATCH_SIZE), desc=desc):
        idx = order[s:s + BATCH_SIZE]
        batch = tok([texts[i] for i in idx], padding=True, truncation=True, max_length=MAX_LENGTH, return_tensors="pt")
        cls = model(**batch).last_hidden_state[:, 0]
        out[idx] = torch.nn.functional.normalize(cls.float(), p=2, dim=-1).numpy()
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", default=str(ROOT / "App/web-server/data/corpus.json"))
    ap.add_argument("--questions", required=True)
    a = ap.parse_args()
    CACHE.mkdir(exist_ok=True)
    corpus_b, q_b = Path(a.corpus).read_bytes(), Path(a.questions).read_bytes()
    model_key = f"{MODEL_NAME}|{MAX_LENGTH}".encode()
    p_file = CACHE / f"bge-m3_passages_{sha(model_key, corpus_b)}.npy"
    q_file = CACHE / f"bge-m3_questions_{sha(model_key, q_b)}.npy"
    r_file = CACHE / f"dense_ranks_{sha(model_key, corpus_b, q_b, str(TOP_N).encode())}.json"

    passages = [p["text"] for p in json.loads(corpus_b)["passages"]]
    questions = [q["question"] for q in json.loads(q_b)]
    model = tok = None

    def load():
        nonlocal model, tok
        if model is None:
            tok = AutoTokenizer.from_pretrained(MODEL_NAME)
            model = AutoModel.from_pretrained(MODEL_NAME).eval()

    if p_file.exists():
        P = np.load(p_file); print(f"passage 임베딩 캐시 사용: {p_file.name}")
    else:
        load(); P = encode(model, tok, passages, "passages"); np.save(p_file, P)
    if q_file.exists():
        Q = np.load(q_file); print(f"질문 임베딩 캐시 사용: {q_file.name}")
    else:
        load(); Q = encode(model, tok, questions, "questions"); np.save(q_file, Q)
    assert P.shape == (len(passages), 1024) and Q.shape == (len(questions), 1024)

    S = Q @ P.T
    ranks = {q: [int(i) for i in np.argsort(-S[j], kind="stable")[:TOP_N or None]] for j, q in enumerate(questions)}
    r_file.write_text(json.dumps(ranks, ensure_ascii=False), encoding="utf-8")
    print(f"dense 순위 저장: {r_file}  ({len(questions)}개 질문 × {TOP_N or '전체'})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
