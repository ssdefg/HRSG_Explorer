import { Card, DataTypeBadges, StatusBadge } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber } from '@/lib/format';
import type { CalculatorState } from '@/context/Workspace';
import { LEVEL_STATUS, levelLabel } from './level';

const CX = 120;
const CY = 120;
const R = 96;
const STROKE = 18;

/** 게이지 최대 눈금 — 입력이 커져도 바늘이 범위를 벗어나지 않도록 50 단위로 올린다 */
function gaugeMax(current: number | null, reference: number | null, bandMax: number): number {
  const base = Math.max(bandMax, (current ?? 0) * 1.1, (reference ?? 0) * 1.2);
  return Math.ceil(base / 50) * 50;
}

function polar(value: number, max: number, radius = R) {
  const clamped = Math.min(Math.max(value, 0), max);
  const angle = Math.PI * (1 - clamped / max);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

function arc(from: number, to: number, max: number, radius = R) {
  const a = polar(from, max, radius);
  const b = polar(to, max, radius);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/** 상태 구간 띠 — 트랙 바깥의 얇은 띠 (정상·주의·위험 임계값 위치를 표시) */
const ZONE_R = R + STROKE / 2 + 4;
const ZONE_STROKE = 3;

export function BackpressureGauge({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const { currentBp, referenceBp, loadPct, exhaustTemp } = state.values;
  const deltaBp = state.metrics.deltaBp.value;
  // 게이지는 GT 배압 하나만 보여 주므로 키트의 GT 배압 지표 판정을 쓴다 (종합 판정은 KPI 카드)
  const level = state.kit.result?.indicators.gt_bp_mbar.level ?? null;
  const bands = state.bands ?? { caution: 0, danger: 0, max: 0 };
  const max = gaugeMax(currentBp, referenceBp, bands.max);
  const n = (x: number | null) => (x === null ? '—' : formatNumber(x, lang, 1));

  const needle = currentBp !== null ? polar(currentBp, max, R - STROKE / 2 - 8) : null;
  const refIn = referenceBp !== null ? polar(referenceBp, max, R - STROKE / 2 - 4) : null;
  const refOut = referenceBp !== null ? polar(referenceBp, max, R + STROKE / 2 + 8) : null;
  const refLabel = referenceBp !== null ? polar(referenceBp, max, R + STROKE / 2 + 18) : null;

  const ariaLabel = `${c.gaugeTitle}: ${c.gaugeCurrent} ${n(currentBp)} mmH₂O, ${c.gaugeReference} ${n(referenceBp)} mmH₂O${
    level ? `, ${levelLabel(level, c)}` : ''
  }`;

  return (
    <Card
      title={c.gaugeTitle}
      subtitle={c.gaugeSubtitle}
      badges={<DataTypeBadges types={['mock', 'unconfirmed']} />}
    >
      <div className="gauge">
        <svg className="gauge__svg" viewBox="0 0 240 150" role="img" aria-label={ariaLabel}>
          {/* 미채움 트랙(그레이) + 현재 값까지 오렌지 채움 */}
          <path d={arc(0, max, max)} className="gauge__track" strokeWidth={STROKE} fill="none" />
          {currentBp !== null && currentBp > 0 && (
            <path d={arc(0, Math.min(currentBp, max), max)} className="gauge__fill" strokeWidth={STROKE} fill="none" />
          )}
          <path d={arc(0, bands.caution, max, ZONE_R)} className="gauge__zone gauge__zone--normal" strokeWidth={ZONE_STROKE} fill="none" />
          <path
            d={arc(bands.caution, bands.danger, max, ZONE_R)}
            className="gauge__zone gauge__zone--caution"
            strokeWidth={ZONE_STROKE}
            fill="none"
          />
          <path d={arc(bands.danger, max, max, ZONE_R)} className="gauge__zone gauge__zone--danger" strokeWidth={ZONE_STROKE} fill="none" />

          {refIn && refOut && refLabel && (
            <g className="gauge__ref">
              <line x1={refIn.x} y1={refIn.y} x2={refOut.x} y2={refOut.y} strokeWidth={2.5} />
              <text x={refLabel.x} y={refLabel.y} textAnchor="middle" dominantBaseline="middle">
                {c.gaugeReference}
              </text>
            </g>
          )}

          {needle && (
            <g className="gauge__needle">
              <line x1={CX} y1={CY} x2={needle.x} y2={needle.y} strokeWidth={3} strokeLinecap="round" />
              <circle cx={CX} cy={CY} r={6} />
            </g>
          )}

          <text x={CX - R} y={CY + 22} textAnchor="middle" className="gauge__tick">
            0
          </text>
          <text x={CX + R} y={CY + 22} textAnchor="middle" className="gauge__tick">
            {formatNumber(max, lang, 0)}
          </text>
        </svg>

        <div className="gauge__readout">
          <div className="gauge__value-row">
            <span className="gauge__value num">{n(currentBp)}</span>
            <span className="gauge__unit">mmH₂O</span>
          </div>
          {level ? (
            <StatusBadge status={LEVEL_STATUS[level]} label={levelLabel(level, c)} />
          ) : (
            <span className="field__error">{c.invalidInput}</span>
          )}
          <dl className="gauge__stats">
            <div>
              <dt>{c.gaugeReference}</dt>
              <dd className="num">{n(referenceBp)}</dd>
            </div>
            <div>
              <dt>{c.gaugeExcess}</dt>
              <dd className="num">{deltaBp === null ? '—' : `+${n(deltaBp)}`}</dd>
            </div>
          </dl>
        </div>
      </div>

      {state.bands && <p className="note">{c.gaugeThresholds(state.bands.caution, state.bands.danger)}</p>}
      <p className="note note--warn">{c.gaugeDisclaimer}</p>

      {/* 판단에 추가로 필요한 데이터 — 기본 접힘 (임계값 안내·면책 문구는 위에 그대로 표시) */}
      <details className="fold">
        <summary className="fold__summary">{c.gaugeNeedsData}</summary>
        <div className="needs">
          <ul className="needs__list">
            {c.gaugeNeedsList.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className="needs__context">
            {c.gaugeContext}: {lang === 'ko' ? '부하율' : 'Load'} <span className="num">{n(loadPct)}%</span> ·{' '}
            {c.exhaustTemp} <span className="num">{n(exhaustTemp)}°C</span> <DataTypeBadges types={['mock']} />
          </p>
        </div>
      </details>
    </Card>
  );
}
