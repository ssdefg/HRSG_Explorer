"""rag/metadata.json (서버가 색인하는 문단) + doc_map.json + bibliography.json → public/data/rag_corpus.json

정적 사이트 단독(Standalone) 배포에서 브라우저가 직접 BM25 로 문헌을 검색하도록 하나의 JSON 으로 묶는다.
문단 텍스트는 서버와 같은 원문 그대로 (HRSG·저작권 측의 공개 배포 허락을 받은 뒤 커밋한다).

사용법:  python scripts/build_web_corpus.py     (scripts/build_corpus.py · build_bibliography.py 를 먼저 실행)
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAG = ROOT / "rag"
OUT = ROOT / "public" / "data" / "rag_corpus.json"


def main() -> None:
    passages = json.loads((RAG / "metadata.json").read_text(encoding="utf-8"))
    doc_map = json.loads((RAG / "doc_map.json").read_text(encoding="utf-8"))
    bib_path = RAG / "bibliography.json"
    bib = json.loads(bib_path.read_text(encoding="utf-8")) if bib_path.exists() else {}

    used = sorted({p["doc_id"] for p in passages})
    docs = {}
    for d in used:
        b = bib.get(d, {})
        docs[d] = {"file": doc_map.get(d, {}).get("file", ""), "title": b.get("title"), "doi": b.get("doi"), "citation": b.get("citation")}

    out = {
        "version": 1,
        "source": "rag/metadata.json",
        "docs": docs,
        # [id, doc_id, page, text] — 키 반복을 줄여 용량을 아낀다
        "passages": [[p["id"], p["doc_id"], p["page"], p["text"]] for p in passages],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: 문헌 {len(docs)}편 · 문단 {len(passages)}개 · {OUT.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
