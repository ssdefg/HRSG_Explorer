import { useState, type FormEvent } from 'react';
import { Card, DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useMeasurements } from '@/context/Workspace';
import { parseNumericInput } from '@/lib/number';
import { formatNumber } from '@/lib/format';
import { VALIDATION_SCENARIO } from '@/data/validationScenario';

const TXT = {
  ko: {
    title: '실측 데이터 입력',
    sub: '클라우드라로부터 측정값을 받으면 이 영역에 입력합니다. 입력값은 가상 시나리오와 별도 계열로 표시됩니다.',
    day: '경과일 (세정일 = 0)',
    bp: '배압 (mmH₂O)',
    temp: '배기가스 출구 온도 (°C)',
    add: '측정값 추가',
    clear: '전체 삭제',
    remove: '삭제',
    empty: '실측 데이터 미입력',
    emptyDesc: '현재 입력된 측정값이 없습니다. 화면의 모든 전후 비교 수치는 가상 시나리오입니다.',
    errDay: `경과일은 −${VALIDATION_SCENARIO.daysBefore} ~ ${VALIDATION_SCENARIO.daysAfter} 사이의 정수입니다 (0 = 세정 당일).`,
    errVal: '배압 또는 배기가스 온도 중 하나 이상을 올바른 숫자로 입력하세요.',
    errBp: '배압은 0 ~ 1,000 mmH₂O 범위여야 합니다.',
    errTemp: '배기가스 온도는 0 ~ 400 °C 범위여야 합니다.',
    unverified: '검증 전 값 — 계측 위치·조건 확인 필요',
    session: '입력값은 현재 케이스에 저장되며 이 브라우저에만 보관됩니다.',
  },
  en: {
    title: 'Measured data input',
    sub: 'Enter measurements here once received from 클라우드라. They are shown as a separate series from the mock scenario.',
    day: 'Day (cleaning = 0)',
    bp: 'Back pressure (mmH₂O)',
    temp: 'Stack gas outlet temp. (°C)',
    add: 'Add measurement',
    clear: 'Clear all',
    remove: 'Remove',
    empty: 'No measured data',
    emptyDesc: 'No measurements entered. All pre/post figures on this screen are a mock scenario.',
    errDay: `Day must be an integer between −${VALIDATION_SCENARIO.daysBefore} and ${VALIDATION_SCENARIO.daysAfter}, (0 = cleaning day).`,
    errVal: 'Enter a valid number for back pressure and/or stack temperature.',
    errBp: 'Back pressure must be 0–1,000 mmH₂O.',
    errTemp: 'Stack temperature must be 0–400 °C.',
    unverified: 'Unverified — confirm sensor location and conditions',
    session: 'Entries are saved in the current case, in this browser only.',
  },
};

export function MeasuredInput() {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const m = useMeasurements();
  const [day, setDay] = useState('');
  const [bp, setBp] = useState('');
  const [temp, setTemp] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const d = parseNumericInput(day, { min: -VALIDATION_SCENARIO.daysBefore, max: VALIDATION_SCENARIO.daysAfter });
    if (!d.ok || !Number.isInteger(d.value)) return setError(x.errDay);
    const b = bp.trim() === '' ? null : parseNumericInput(bp, { min: 0, max: 1000 });
    const t = temp.trim() === '' ? null : parseNumericInput(temp, { min: 0, max: 400 });
    if (b === null && t === null) return setError(x.errVal);
    if (b && !b.ok) return setError(x.errBp);
    if (t && !t.ok) return setError(x.errTemp);
    m.add({ day: d.value, backPressure: b && b.ok ? b.value : null, exhaustTemp: t && t.ok ? t.value : null });
    setError(null);
    setBp('');
    setTemp('');
  };

  const fmt = (v: number | null, digits = 1) => (v === null ? '—' : formatNumber(v, lang, digits));

  return (
    <Card span={2} title={x.title} subtitle={x.sub} badges={<DataTypeBadges types={[m.entries.length ? 'measured' : 'noMeasured']} />}>
      <form className="measure-form" onSubmit={submit} noValidate>
        <label className="field">
          <span className="field__label">{x.day}</span>
          <input className="text-input num" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} id="m-day" />
        </label>
        <label className="field">
          <span className="field__label">{x.bp}</span>
          <input className="text-input num" inputMode="decimal" value={bp} onChange={(e) => setBp(e.target.value)} id="m-bp" />
        </label>
        <label className="field">
          <span className="field__label">{x.temp}</span>
          <input className="text-input num" inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value)} id="m-temp" />
        </label>
        <button type="submit" className="btn btn--primary measure-form__btn">
          {x.add}
        </button>
      </form>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}

      {m.entries.length === 0 ? (
        <div className="pending-state measure-empty" role="status">
          <span className="pending-state__icon" aria-hidden="true">
            ∅
          </span>
          <div>
            <p className="pending-state__title">{x.empty}</p>
            <p className="pending-state__desc">{x.emptyDesc}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" className="num-col">
                    {x.day}
                  </th>
                  <th scope="col" className="num-col">
                    {x.bp}
                  </th>
                  <th scope="col" className="num-col">
                    {x.temp}
                  </th>
                  <th scope="col" />
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {m.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="num-col num">{e.day}</td>
                    <td className="num-col num">{fmt(e.backPressure)}</td>
                    <td className="num-col num">{fmt(e.exhaustTemp)}</td>
                    <td>
                      <span className="badge-row">
                        <DataTypeBadges types={['measured']} />
                        <span className="note">{x.unverified}</span>
                      </span>
                    </td>
                    <td>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => m.remove(e.id)}>
                        {x.remove}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={m.clear}>
            {x.clear}
          </button>
        </>
      )}
      <p className="note">{x.session}</p>
    </Card>
  );
}
