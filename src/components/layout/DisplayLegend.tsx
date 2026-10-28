import type { DataType, OperationalStatus } from '@/types';
import { useAppSettings } from '@/context/AppSettings';
import { Card, DataTypeBadge, StatusBadge } from '@/components/ui';

const OPERATIONAL: OperationalStatus[] = ['normal', 'caution', 'warning', 'trip'];
const DATA_TYPES: DataType[] = ['mock', 'scenario', 'example', 'unconfirmed', 'noMeasured', 'measured', 'userInput', 'implemented', 'planned'];

/** 운전 상태 배지와 데이터 유형 배지의 차이를 설명하는 범례 */
export function DisplayLegend() {
  const { t } = useAppSettings();
  return (
    <Card title={t.legendTitle}>
      <div className="legend">
        <div>
          <p className="legend__group-title">{t.legendOperational}</p>
          <div className="legend__items">
            {OPERATIONAL.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
        </div>
        <div>
          <p className="legend__group-title">{t.legendData}</p>
          <div className="legend__items">
            {DATA_TYPES.map((d) => (
              <DataTypeBadge key={d} type={d} />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
