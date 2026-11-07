import type { DataType } from '@/types';
import { Card, DataTypeBadge, DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber, pick } from '@/lib/format';
import { KIT_CALC_DATA } from '@/lib/kit';
import type { CalculatorState } from '@/context/Workspace';
import type { MetricId } from '@/lib/calculatorModel';
import { METRIC_STATUS_TEXT } from './metricText';
import { HRSG_CLASSES, NUMERIC_INPUTS } from '@/data/calculatorInputs';
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
          key: 'coeff-gt',
          name: `${c.invCoeff} (GT)`,
          value: String(KIT_CALC_DATA.constants.gt_loss_pct_per_mbar),
          unit: '%/mbar',
          types: ['example', 'unconfirmed'],
          provisional: true,
          replace: 'model',
        },
        {
          key: 'coeff-st',
          name: `${c.invCoeff} (ST)`,
          value: String(KIT_CALC_DATA.constants.st_loss_pct_per_c),
          unit: '%/°C',
          types: ['example', 'unconfirmed'],
          provisional: true,
          replace: 'model',
        },
        {
          key: 'outage-margin',
          name: lang === 'ko' ? '정지 손실 마진율' : 'Outage margin ratio',
          value: String(KIT_CALC_DATA.constants.outage_margin_ratio),
          unit: '—',
          types: ['example', 'unconfirmed'],
          provisional: true,
          replace: 'model',
        },
        {
          key: 'thr-c',
          name: c.invThrCaution,
          value: n(state.bands?.caution ?? null, 1),
          unit: 'mmH₂O',
          types: ['unconfirmed'],
          provisional: true,
          replace: 'unconfirmed',
        },
        {
          key: 'thr-d',
          name: c.invThrDanger,
          value: n(state.bands?.danger ?? null, 1),
          unit: 'mmH₂O',
          types: ['unconfirmed'],
          provisional: true,
          replace: 'unconfirmed',
        },
      ],
    },
    {
      title: c.invCleaning,
      rows: KIT_CALC_DATA.methods.flatMap<Row>((m) => [
        {
          key: `${m.id}-cost`,
          name: `${m.name} · ${c.cleanCost}`,
          value: n(m.cost_krw),
          unit: won,
          types: ['mock'],
          provisional: true,
          replace: 'noMeasured',
        },
        {
          key: `${m.id}-ratio`,
          name: `${m.name} · ${lang === 'ko' ? '회수율' : 'recovery ratio'}`,
          value: m.recovery_ratio === null ? '—' : String(m.recovery_ratio),
          unit: '0~1',
          types: ['mock', 'unconfirmed'],
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
            ['recoveredMw', lang === 'ko' ? '세정 예상 회수 출력' : 'Expected recovered output', 'MW', 2],
            ['shutdownLossKrw', lang === 'ko' ? '정지 손실' : 'Outage loss', won, 0],
            ['initialInvestmentKrw', lang === 'ko' ? '총투자' : 'Total investment', won, 0],
            ['netBenefitKrw', lang === 'ko' ? '첫 달 순편익' : 'First-month net', won, 0],
            ['paybackMonths', lang === 'ko' ? '투자 회수기간' : 'Payback', lang === 'ko' ? '개월' : 'months', 2],
            ['cleaningScore', lang === 'ko' ? '세정 필요도 지수' : 'Cleaning-need score', '/100', 1],
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
