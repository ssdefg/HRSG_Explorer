import type { DataType } from '@/types';
import { Card, DataTypeBadge, DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber, pick } from '@/lib/format';
import { BP_THRESHOLDS, POWER_LOSS_COEFF_MW_PER_MMH2O } from '@/lib/calc';
import type { CalculatorState } from '@/context/Workspace';
import type { MetricId } from '@/lib/calculatorModel';
import { METRIC_STATUS_TEXT } from './metricText';
import { HRSG_CLASSES, NUMERIC_INPUTS } from '@/data/calculatorInputs';
import { MOCK_CLEANING_METHODS } from '@/data/mockCleaning';
import { SECTION_IDS } from '@/data/tabs';

interface Row {
  key: string;
  name: string;
  value: string;
  unit: string;
  types: DataType[];
  provisional: boolean;
  /** 교체 필요 시 표시할 상태 — null이면 교체 불필요 */
  replace: 'noMeasured' | 'unconfirmed' | 'model' | null;
}

/** 화면에 쓰인 모든 값의 출처·가정 여부·교체 필요 여부를 한 곳에서 보여준다. */
export function DataInventory({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const { values, metrics, hrsgClass } = state;
  const n = (v: number | null, d = 0) => (v === null ? '—' : formatNumber(v, lang, d));
  const won = lang === 'ko' ? '원' : 'KRW';

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: c.invInputs,
      rows: [
        {
          key: 'class',
          name: c.hrsgClass,
          value: `${HRSG_CLASSES.find((x) => x.value === hrsgClass)?.label ?? '—'} · ${state.model}`,
          unit: '—',
          types: ['mock'],
          provisional: true,
          replace: 'unconfirmed',
        },
        ...NUMERIC_INPUTS.map<Row>((d) => ({
          key: d.id,
          name: d.label[lang],
          value: n(values[d.id], d.digits),
          unit: pick(d.unit, lang),
          types: state.mode === 'user' && state.edited[d.id] ? ['userInput'] : d.dataTypes,
          provisional: true,
          replace: d.needsReal ? d.missingType : null,
        })),
      ],
    },
    {
      title: c.invAssumptions,
      rows: [
        {
          key: 'coeff',
          name: c.invCoeff,
          value: String(POWER_LOSS_COEFF_MW_PER_MMH2O),
          unit: 'MW/mmH₂O',
          types: ['example', 'unconfirmed'],
          provisional: true,
          replace: 'model',
        },
        {
          key: 'thr-c',
          name: c.invThrCaution,
          value: n(BP_THRESHOLDS.caution),
          unit: 'mmH₂O',
          types: ['unconfirmed'],
          provisional: true,
          replace: 'unconfirmed',
        },
        {
          key: 'thr-d',
          name: c.invThrDanger,
          value: n(BP_THRESHOLDS.danger),
          unit: 'mmH₂O',
          types: ['unconfirmed'],
          provisional: true,
          replace: 'unconfirmed',
        },
      ],
    },
    {
      title: c.invCleaning,
      rows: MOCK_CLEANING_METHODS.flatMap<Row>((m) => [
        {
          key: `${m.id}-cost`,
          name: `${m.label[lang]} · ${c.cleanCost}`,
          value: n(m.costKrw),
          unit: won,
          types: ['mock'],
          provisional: true,
          replace: 'noMeasured',
        },
        {
          key: `${m.id}-benefit`,
          name: `${m.label[lang]} · ${c.cleanBenefit}`,
          value: n(m.monthlyBenefitKrw),
          unit: won,
          types: ['mock'],
          provisional: true,
          replace: 'noMeasured',
        },
      ]),
    },
    {
      title: c.invOutputs,
      rows: [
        ...(
          [
            ['deltaBp', c.stepDelta, 'mmH₂O', 0],
            ['powerLossMw', c.stepPower, 'MW', 2],
            ['monthlyLossKrw', c.stepMonthly, won, 0],
            ['additionalRevenueKrw', lang === 'ko' ? '추가 발전 매출' : 'Additional revenue', won, 0],
            ['shutdownLossKrw', lang === 'ko' ? '정지 손실' : 'Shutdown loss', won, 0],
            ['netBenefitKrw', lang === 'ko' ? '세정 순편익 (첫 1개월)' : 'Net benefit (first month)', won, 0],
            ['paybackMonths', lang === 'ko' ? '단순 회수 기간' : 'Simple payback', lang === 'ko' ? '개월' : 'months', 2],
            ['breakEvenDays', lang === 'ko' ? '손익분기' : 'Break-even', lang === 'ko' ? '일' : 'd', 1],
          ] as [MetricId, string, string, number][]
        ).map<Row>(([id, name, unit, digits]) => ({
          key: id,
          name,
          value: metrics[id].status === 'ok' ? n(metrics[id].value, digits) : `— (${METRIC_STATUS_TEXT[lang][metrics[id].status as 'invalid' | 'model']})`,
          unit,
          types: metrics[id].status === 'model' ? ['planned'] : ['example'],
          provisional: true,
          replace: 'model',
        })),
      ],
    },
  ];

  const rowCount = groups.reduce((sum, g) => sum + g.rows.length, 0);
  const showTable = lang === 'ko' ? `전체 표 보기 (${rowCount}개 항목)` : `Show full table (${rowCount} items)`;

  return (
    <Card id={SECTION_IDS.inventory} span={2} title={c.invTitle} subtitle={c.invSubtitle} badges={<DataTypeBadges types={['mock', 'example']} />}>
      {/* 전체 값·가정 목록 — 기본 접힘 */}
      <details className="fold">
        <summary className="fold__summary">{showTable}</summary>
        <div className="table-wrap">
          <table className="data-table data-table--inventory">
            <thead>
              <tr>
                <th scope="col">{c.invItem}</th>
                <th scope="col" className="num-col">
                  {c.invValue}
                </th>
                <th scope="col">{c.invUnit}</th>
                <th scope="col">{c.invType}</th>
                <th scope="col">{c.invAssumption}</th>
                <th scope="col">{c.invReplace}</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.title}>
                <tr className="data-table__group">
                  <th scope="colgroup" colSpan={6}>
                    {g.title}
                  </th>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row">{r.name}</th>
                    <td className="num-col num">{r.value}</td>
                    <td className="data-table__unit">{r.unit}</td>
                    <td>
                      <span className="badge-row">
                        <DataTypeBadges types={r.types} />
                      </span>
                    </td>
                    <td>{r.provisional ? c.yes : c.no}</td>
                    <td>
                      {r.replace === null ? (
                        c.no
                      ) : (
                        <span className="badge-row">
                          <span className="replace-flag">{r.replace === 'model' ? c.modelCheck : c.required}</span>
                          {r.replace !== 'model' && <DataTypeBadge type={r.replace} />}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </details>
    </Card>
  );
}
