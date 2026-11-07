/**
 * 어댑터 검증용 샘플 출력 — 앱 기본 입력(케이스 기본값)을 앱과 똑같은 경로(deriveCalculator → calc_adapter → 키트)로 계산해
 * 키트 README 「기대값」 표와 나란히 출력한다. 실행: npm run kit:sample
 */
import { defaultCalc, defaultChecklist } from '@/lib/caseStore';
import { deriveCalculator } from '@/lib/calculatorModel';
import { formatKrw } from '@/lib/calc_adapter';
import { computeProgress, computeReadiness } from '@/lib/checklistStats';
import { validateProgress } from '@/lib/checklist_adapter';
import { CHECKLIST_CATEGORIES } from '@/data/checklistItems';

const d = deriveCalculator(defaultCalc());
const m = d.metrics;
const r = d.kit.result!;
const f = (v: number | null | undefined, digits: number) => (v == null ? '—' : v.toFixed(digits));

console.log('== 어댑터가 만든 키트 입력 (inp) ==');
console.log(JSON.stringify(d.kit.run.inp, null, 1));
console.log(`validateInputs: errors ${d.kit.run.errors.length}, warnings ${d.kit.run.warnings.length}`);
for (const e of [...d.kit.run.errors, ...d.kit.run.warnings]) console.log('  -', e);

const rows: [string, string, string][] = [
  ['현재 배압', '305.9 mmH₂O', `${f(d.values.currentBp, 1)} mmH₂O (키트 ${f(r.kpi.current_bp.mmh2o, 1)})`],
  ['초과 배압', '51.0 mmH₂O', `${f(m.deltaBp.value, 1)} mmH₂O`],
  ['출력 손실', '1.89 MW', `${f(m.powerLossMw.value, 2)} MW (GT ${f(m.gtLossMw.value, 2)} + ST ${f(m.stLossMw.value, 2)})`],
  ['월간 손실', '2.04억 원', formatKrw(m.monthlyLossKrw.value)],
  ['회수 출력', '1.32 MW', `${f(m.recoveredMw.value, 2)} MW`],
  ['투자', '4.46억 원 (드라이아이스 세정)', `${formatKrw(m.initialInvestmentKrw.value)} (${d.cleaning.methodName})`],
  ['월간 편익', '1.43억 원', formatKrw(m.monthlyIncrementalBenefitKrw.value)],
  ['첫 달 순편익', '-3.03억 원', formatKrw(m.netBenefitKrw.value)],
  ['회수기간', '3.12개월', `${f(m.paybackMonths.value, 2)}개월`],
  ['손익분기', '93.6일', `${f(m.breakEvenDays.value, 1)}일`],
  ['경고', '없음', r.warnings.length ? r.warnings.join(' / ') : '없음'],
  ['게이지', '51.0 / 203.9 mmH₂O', `${f(r.gauge.value.mmh2o, 1)} / ${f(r.gauge.max.mmh2o, 1)} mmH₂O`],
  ['공개 참고 구간', '76.2~101.6', r.gauge.public_ref.map((p) => f(p.mmh2o, 1)).join('~')],
  ['세정 필요도', '41.1 (배압 33.3 · 온도 7.8)', `${f(r.index.value, 1)} (배압 ${f(r.index.pressure_part, 1)} · 온도 ${f(r.index.temp_part, 1)})`],
  ['핀치 / 어프로치', '8.0 / 5.0 °C · 설계 범위 안입니다.', `${f(d.pinch.pinchC, 1)} / ${f(d.pinch.approachC, 1)} °C · ${d.pinch.message}`],
  [
    '공법 비교 (회수기간)',
    '드라이아이스 3.12 → 고압수 3.30 → 기계식 3.54 → 화학 4.27',
    [...d.kit.methods]
      .filter((x) => x.available)
      .sort((a, b) => (a.payback_months ?? 0) - (b.payback_months ?? 0))
      .map((x) => `${x.name.replace(' 세정', '')} ${f(x.payback_months, 2)}`)
      .join(' → '),
  ],
];

const cl = defaultChecklist();
const p = computeProgress(cl.progress);
const rd = computeReadiness(cl.progress);
rows.push(
  ['체크리스트 수령률', '0% 0/49', `${p.receivedPct}% ${p.receivedCount}/${p.total}`],
  ['필수 충족', '0/16', `${rd.requiredTotal - rd.missingIds.length}/${rd.requiredTotal}`],
  ['카테고리', 'A 0/6 · B 0/13 · C 0/9 · D 0/3 · E 0/18', CHECKLIST_CATEGORIES.map((c) => `${c} ${computeProgress(cl.progress, c).receivedCount}/${computeProgress(cl.progress, c).total}`).join(' · ')],
  ['validateProgress', 'ok', validateProgress(cl.progress).ok ? 'ok' : validateProgress(cl.progress).errors.join(', ')],
);

console.log('\n== 어댑터 경유 결과 vs 키트 README 기대값 ==');
const w = Math.max(...rows.map(([k]) => k.length));
for (const [k, exp, got] of rows) console.log(`${k.padEnd(w)} | 기대 ${exp}\n${' '.repeat(w)} | 앱   ${got}`);
