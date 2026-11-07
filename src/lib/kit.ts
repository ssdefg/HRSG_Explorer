/**
 * 계산기·체크리스트 키트(hrsg_calc_kit_team1)의 유일한 import 지점.
 *
 * - 키트가 계산식·상수·체크리스트 항목의 단일 기준(SSOT)이다. 앱은 같은 값을 다시 정의하지 않는다.
 * - 키트 폴더는 팀 공통 코어이며 수정하지 않고, 외부 재배포 금지라 git 에 올리지 않는다(.gitignore).
 *   클론한 뒤에는 키트 폴더를 프로젝트 루트에 직접 넣어야 빌드·테스트가 된다.
 * - 화면 입력 ↔ 키트 입력·결과 변환은 calc_adapter.ts · checklist_adapter.ts 에서만 한다.
 */
import * as calc from '@kit/calc.js';
import * as checklist from '@kit/checklist.js';
import CALC_DATA from '@kit/data/calculator.json';
import CHECKLIST_DATA from '@kit/data/checklist.json';

export { calc as kitCalc, checklist as kitChecklist, CALC_DATA as KIT_CALC_DATA, CHECKLIST_DATA as KIT_CHECKLIST_DATA };
export type { KitInput, KitResult, KitMethodRow, KitPinchSection, KitLevel, KitLossCurve } from '@kit/calc.js';
export type { KitProgress, KitProgressEntry, KitSupply, KitVerify } from '@kit/checklist.js';
export type { KitChecklistItem } from '@kit/data/checklist.json';
export type { KitGtClass } from '@kit/data/calculator.json';
