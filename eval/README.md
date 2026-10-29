# 검색 평가

```
python eval/eval_retrieval.py eval/<파일명>.json
```

- 평가셋 형식: `{"questions": [{id, query, lang, target_doc_ids, split, answerable}, ...]}` — 인자를 생략하면 `eval/mock_eval_dataset.json`(모의 평가셋)을 쓴다.
- 결합 가중치 튜닝은 dev 분할만 본다: `python eval/tune_dev.py eval/<파일명>.json`
- 원인 분석 실험 (운영에는 반영하지 않음): `python eval/exp_korean_bm25.py` — 한국어 질의 BM25 에 용어집 영문 확장 · Kiwi 형태소 토큰화를 적용해 dev 지표를 비교한다. `kiwipiepy` 가 필요하다. 용어집은 평가 질문을 본 뒤 작성해 dev·test 한국어 질문 전부에 걸리므로, 확장 결과는 상한값으로만 본다.
