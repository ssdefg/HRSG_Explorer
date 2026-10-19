import { Card, DataTypeBadges, StatusBadge } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber } from '@/lib/format';
import { BP_THRESHOLDS } from '@/lib/calc';
import type { CalculatorState } from '@/lib/useCalculatorState';
import { LEVEL_STATUS, levelLabel } from './level';

const CX = 120;
const CY = 120;
const R = 96;
const STROKE = 18;

/** 게이지 최대 눈금 — 입력이 커져도 바늘이 범위를 벗어나지 않도록 50 단위로 올린다 */
function gaugeMax(current: number | null, reference: number | null): number {
  const base = Math.max(400, (current ?? 0) * 1.15, (reference ?? 0) * 1.2);
  return Math.ceil(base / 50) * 50;
}

function polar(value: number, max: number, radius = R) {
  const clamped = Math.min(Math.max(value, 0), max);
  const angle = Math.PI * (1 - clamped / max);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

function arc(from: number, to: number, max: number) {
  const a = polar(from, max);
  const b = polar(to, max);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export function BackpressureGauge({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const { currentBp, referenceBp, loadPct, exhaustTemp } = state.values;
  const { deltaBp, level } = state.result;
  const max = gaugeMax(currentBp, referenceBp);
  const n = (x: number | null) => (x === null ? '—' : formatNumber(x, lang, 0));

  const needle = currentBp !== null ? polar(currentBp, max, R - STROKE / 2 - 8) : null;
  const refIn = referenceBp !== null ? polar(referenceBp, max, R - STROKE / 2 - 4) : null;
  const refOut = referenceBp !== null ? polar(referenceBp, max, R + STROKE / 2 + 4) : null;
  const refLabel = referenceBp !== null ? polar(referenceBp, max, R + STROKE / 2 + 16) : null;

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
          <path d={arc(0, max, max)} className="gauge__track" strokeWidth={STROKE} fill="none" />
          <path d={arc(0, BP_THRESHOLDS.caution, max)} className="gauge__zone gauge__zone--normal" strokeWidth={STROKE} fill="none" />
          <path
            d={arc(BP_THRESHOLDS.caution, BP_THRESHOLDS.danger, max)}
            className="gauge__zone gauge__zone--caution"
            strokeWidth={STROKE}
            fill="none"
          />
          <path d={arc(BP_THRESHOLDS.danger, max, max)} className="gauge__zone gauge__zone--danger" strokeWidth={STROKE} fill="none" />

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

      <p className="note">{c.gaugeThresholds}</p>
      <p className="note note--warn">{c.gaugeDisclaimer}</p>

      <div className="needs">
        <p className="needs__title">{c.gaugeNeedsData}</p>
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
    </Card>
  );
}
