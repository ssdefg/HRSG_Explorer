# 검색 평가

```
python eval/eval_retrieval.py eval/<파일명>.json
```

- 평가셋 형식: `{"questions": [{id, query, lang, target_doc_ids, split, answerable}, ...]}` — 인자를 생략하면 `eval/mock_eval_dataset.json`(모의 평가셋)을 쓴다.
- 결합 가중치 튜닝은 dev 분할만 본다: `python eval/tune_dev.py eval/<파일명>.json`
