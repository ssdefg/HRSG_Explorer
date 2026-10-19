import { useState, type KeyboardEvent } from 'react';
import type { Localized } from '@/types';
import { Card, DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber } from '@/lib/format';
import type { ParsedValues } from '@/lib/useCalculatorState';
import type { NumericInputId } from '@/data/calculatorInputs';
import { INPUT_DEF } from '@/data/calculatorInputs';

type PartId = 'inlet' | 'superheater' | 'evaporator' | 'economizer' | 'outlet' | 'flow';

interface PartInfo {
  name: string;
  desc: Localized;
  /** 이 구성요소와 연결된 계산기 입력값 */
  inputs: NumericInputId[];
}

/** 일반적인 HRSG 구성 개념 설명 — 특정 설비의 설계 정보가 아니다. */
const PARTS: Record<PartId, PartInfo> = {
  inlet: {
    name: 'Gas Inlet',
    desc: {
      ko: '가스터빈 배기가스가 HRSG로 유입되는 구간입니다. 실제 유량·온도 분포는 설비 데이터가 필요합니다.',
      en: 'Where gas-turbine exhaust enters the HRSG. Actual flow and temperature profile require plant data.',
    },
    inputs: [],
  },
  superheater: {
    name: 'Superheater',
    desc: {
      ko: '드럼에서 나온 포화증기를 고온 배기가스로 과열해 증기터빈으로 보냅니다. 가스 상류(고온) 쪽에 위치합니다.',
      en: 'Superheats saturated steam from the drum using the hottest gas, then sends it to the steam turbine.',
    },
    inputs: [],
  },
  evaporator: {
    name: 'Evaporator',
    desc: {
      ko: '드럼과 연결되어 급수를 증발시켜 포화증기를 만듭니다. 증발기 출구 가스 온도는 Pinch Point 검토에 쓰이는 값입니다.',
      en: 'Connected to the drum; boils water into saturated steam. Its gas outlet temperature is used in pinch-point review.',
    },
    inputs: ['drumPressure', 'evapOutletGasTemp'],
  },
  economizer: {
    name: 'Economizer',
    desc: {
      ko: '저온 구간에서 급수를 예열해 드럼으로 보냅니다. 출구 급수 온도는 Approach Point 검토에 쓰이는 값입니다.',
      en: 'Preheats feedwater in the cooler gas zone before the drum. Its outlet water temperature is used in approach-point review.',
    },
    inputs: ['econOutletWaterTemp'],
  },
  outlet: {
    name: 'Gas Outlet',
    desc: {
      ko: '열을 회수한 배기가스가 굴뚝으로 배출됩니다. 튜브 파울링은 가스측 압력손실(배압)과 출구 온도 상승으로 나타날 수 있습니다.',
      en: 'Cooled exhaust leaves through the stack. Tube fouling may appear as higher gas-side pressure loss (back pressure) and outlet temperature.',
    },
    inputs: ['exhaustTemp', 'currentBp'],
  },
  flow: {
    name: 'Steam/Water Flow',
    desc: {
      ko: '급수 → Economizer → Drum/Evaporator → Superheater → 증기터빈 순으로 흐르며, 가스 흐름과 반대 방향(대향류) 개념입니다.',
      en: 'Feedwater → Economizer → Drum/Evaporator → Superheater → steam turbine, counter to the gas flow.',
    },
    inputs: ['drumPressure'],
  },
};

const ORDER: PartId[] = ['inlet', 'superheater', 'evaporator', 'economizer', 'outlet', 'flow'];

export function HrsgDiagram({ values }: { values: ParsedValues }) {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const [pinned, setPinned] = useState<PartId | null>(null);
  const [hover, setHover] = useState<PartId | null>(null);
  const active = hover ?? pinned;

  const fmt = (id: NumericInputId) => {
    const v = values[id];
    const d = INPUT_DEF[id];
    const unit = typeof d.unit === 'string' ? d.unit : d.unit[lang];
    return v === null ? '—' : `${formatNumber(v, lang, d.digits)} ${unit}`;
  };

  /** SVG 구성요소에 hover·focus·click·키보드 상호작용을 부여 */
  const bind = (id: PartId) => ({
    role: 'button',
    tabIndex: 0,
    'aria-label': PARTS[id].name,
    'aria-pressed': pinned === id,
    className: `hrsg__part${active === id ? ' is-active' : ''}`,
    onMouseEnter: () => setHover(id),
    onMouseLeave: () => setHover(null),
    onFocus: () => setHover(id),
    onBlur: () => setHover(null),
    onClick: () => setPinned((p) => (p === id ? null : id)),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setPinned((p) => (p === id ? null : id));
      }
    },
  });

  const bank = (x: number, w: number, tubes: number) =>
    Array.from({ length: tubes }, (_, i) => {
      const tx = x + ((i + 1) * w) / (tubes + 1);
      return <line key={i} x1={tx} y1={102} x2={tx} y2={198} className="hrsg__tube" />;
    });

  const info = active ? PARTS[active] : null;

  return (
    <Card title={c.diagramTitle} badges={<span className="concept-tag">{c.diagramNotice}</span>}>
      <div className="hrsg">
        <svg className="hrsg__svg" viewBox="0 0 600 272" aria-label={`${c.diagramTitle} — ${c.diagramNotice}`}>
          <defs>
            <marker id="arrow-gas" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" className="hrsg__arrowhead--gas" />
            </marker>
            <marker id="arrow-water" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" className="hrsg__arrowhead--water" />
            </marker>
          </defs>

          {/* 덕트 외곽 */}
          <rect x="20" y="90" width="520" height="120" rx="4" className="hrsg__duct" />
          <rect x="490" y="18" width="50" height="72" className="hrsg__duct" />

          {/* Gas Inlet */}
          <g {...bind('inlet')}>
            <rect x="24" y="94" width="76" height="112" className="hrsg__zone" />
            <text x="62" y="150" textAnchor="middle" className="hrsg__label">Gas</text>
            <text x="62" y="165" textAnchor="middle" className="hrsg__label">Inlet</text>
          </g>

          {/* Superheater */}
          <g {...bind('superheater')}>
            <rect x="120" y="98" width="70" height="104" rx="3" className="hrsg__bank" />
            {bank(120, 70, 5)}
            <text x="155" y="226" textAnchor="middle" className="hrsg__label">Superheater</text>
          </g>

          {/* Evaporator + Drum */}
          <g {...bind('evaporator')}>
            <rect x="230" y="98" width="90" height="104" rx="3" className="hrsg__bank" />
            {bank(230, 90, 6)}
            <rect x="240" y="40" width="70" height="24" rx="12" className="hrsg__drum" />
            <line x1="258" y1="64" x2="258" y2="98" className="hrsg__riser" />
            <line x1="292" y1="64" x2="292" y2="98" className="hrsg__riser" />
            <text x="275" y="56" textAnchor="middle" className="hrsg__label hrsg__label--small">Drum</text>
            <text x="275" y="226" textAnchor="middle" className="hrsg__label">Evaporator</text>
          </g>

          {/* Economizer */}
          <g {...bind('economizer')}>
            <rect x="360" y="98" width="70" height="104" rx="3" className="hrsg__bank" />
            {bank(360, 70, 5)}
            <text x="395" y="226" textAnchor="middle" className="hrsg__label">Economizer</text>
          </g>

          {/* Gas Outlet / Stack */}
          <g {...bind('outlet')}>
            <rect x="450" y="94" width="86" height="112" className="hrsg__zone" />
            <rect x="494" y="22" width="42" height="72" className="hrsg__zone" />
            <text x="493" y="150" textAnchor="middle" className="hrsg__label">Gas</text>
            <text x="493" y="165" textAnchor="middle" className="hrsg__label">Outlet</text>
          </g>

          {/* 배기가스 흐름 (좌 → 우 → 굴뚝) */}
          <g className="hrsg__gas" aria-hidden="true">
            <line x1="30" y1="264" x2="470" y2="264" markerEnd="url(#arrow-gas)" />
            <text x="250" y="256" textAnchor="middle" className="hrsg__label hrsg__label--small">
              {c.gasFlow} →
            </text>
            <line x1="515" y1="60" x2="515" y2="12" markerEnd="url(#arrow-water)" className="hrsg__stack-arrow" />
          </g>

          {/* Steam/Water Flow — 급수 → ECO → Drum → SH → 증기터빈 */}
          <g {...bind('flow')}>
            <path
              d="M470 30 H415 V98 M375 98 V52 H310 M240 52 H165 V98 M135 98 V24 H24"
              className="hrsg__flow-hit"
            />
            <path
              d="M470 30 H415 V96"
              className="hrsg__flow"
              markerEnd="url(#arrow-water)"
            />
            <path d="M375 96 V52 H312" className="hrsg__flow" markerEnd="url(#arrow-water)" />
            <path d="M238 52 H165 V96" className="hrsg__flow" markerEnd="url(#arrow-water)" />
            <path d="M135 96 V24 H28" className="hrsg__flow" markerEnd="url(#arrow-water)" />
            <text x="444" y="24" textAnchor="middle" className="hrsg__label hrsg__label--small hrsg__label--flow">
              Feedwater
            </text>
            <text x="64" y="18" textAnchor="middle" className="hrsg__label hrsg__label--small hrsg__label--flow">
              Steam → ST
            </text>
          </g>
        </svg>

        <div className="hrsg__parts" role="group" aria-label={c.diagramTitle}>
          {ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={pinned === id}
              onClick={() => setPinned((p) => (p === id ? null : id))}
              onMouseEnter={() => setHover(id)}
              onMouseLeave={() => setHover(null)}
            >
              {PARTS[id].name}
            </button>
          ))}
        </div>

        <div className="hrsg__info" aria-live="polite">
          {info ? (
            <>
              <p className="hrsg__info-title">{info.name}</p>
              <p className="hrsg__info-desc">{info.desc[lang]}</p>
              {info.inputs.length > 0 && (
                <ul className="hrsg__info-inputs">
                  {info.inputs.map((id) => (
                    <li key={id}>
                      <span>{INPUT_DEF[id].label[lang]}</span>
                      <strong className="num">{fmt(id)}</strong>
                      <DataTypeBadges types={['mock']} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="hrsg__info-desc">{c.diagramHint}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
