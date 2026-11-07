import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, expandQuery, searchIndex, toSources, tokenize, type WebCorpus } from '@/lib/docSearch';
import { buildRagUserText } from '@/lib/geminiDirect';

const corpus: WebCorpus = {
  version: 1,
  docs: {
    A: { file: 'a.pdf', title: 'Pinch point design', doi: '10.1/a', citation: 'A (2020)' },
    B: { file: 'b.pdf', title: 'Fouling and cleaning', doi: null, citation: null },
  },
  passages: [
    ['A_p1_c1', 'A', 1, 'The pinch point temperature difference of the evaporator is typically 8 to 15 K.'],
    ['A_p2_c1', 'A', 2, 'Approach temperature of the economizer avoids steaming.'],
    ['A_p3_c1', 'A', 3, 'Pinch point selection trades surface area against heat recovery.'],
    ['B_p1_c1', 'B', 1, 'Gas side fouling raises back pressure; dry ice blasting cleaning restores it.'],
    ['B_p2_c1', 'B', 2, 'Water chemistry controls corrosion in the drum.'],
  ],
};

test('브라우저 문헌 검색: 토큰화 · 한국어 용어 확장 · BM25 순위 · 문헌당 2문단', () => {
  assert.deepEqual(tokenize('HRSG CO2 핀치는?'), ['hrsg', 'co2', '핀치는']);
  assert.ok(expandQuery('핀치 포인트 기준은?').includes('pinch'));
  assert.deepEqual(expandQuery('pinch point'), ['pinch', 'point']); // 영어 질문은 그대로

  const idx = buildIndex(corpus);
  const hits = searchIndex(idx, '핀치 포인트 온도차');
  assert.equal(corpus.passages[hits[0].index][0], 'A_p1_c1');
  assert.ok(hits.filter((h) => corpus.passages[h.index][1] === 'A').length <= 2);

  const ko = searchIndex(idx, '배압이 오르면 드라이아이스 세정이 효과가 있나?');
  assert.equal(corpus.passages[ko[0].index][0], 'B_p1_c1');
  assert.deepEqual(searchIndex(idx, '날씨 어때'), []); // 맞는 단어 없음 → 근거 없음

  const src = toSources(idx, hits);
  assert.equal(src[0].rank, 1);
  assert.equal(src[0].title, 'Pinch point design');
  assert.equal(src[0].file, 'a.pdf');
  assert.equal(src[0].dense_rank, null);
  assert.equal(src[0].bm25_rank, 1);

  const prompt = buildRagUserText('핀치 기준은?', src);
  assert.ok(prompt.startsWith('[참고 문헌 컨텍스트]'));
  assert.ok(prompt.includes('[1] (출처: A, Page 1) The pinch point'));
  assert.ok(prompt.endsWith('[질문]\n핀치 기준은?'));
});
