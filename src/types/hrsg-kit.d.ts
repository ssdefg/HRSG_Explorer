/**
 * hrsg_calc_kit_team1 (JavaScript, 타입 없음) 의 타입 선언 — 앱이 쓰는 부분만.
 * 키트 폴더는 고치지 않으므로 타입은 여기 둔다. 실제 모양은 키트 calc.js · checklist.js · data/*.json 참고.
 */

declare module '@kit/data/calculator.json' {
  export interface KitIndicator {
    label: string;
    design: number;
    caution: number;
    danger: number;
    min: number;
    max: number;
  }
  export interface KitGtClass {
    id: string;
    name: string;
    rated_gt_mw: number;
    rated_st_mw: number;
    hp_steam_tph: number;
    indicators: { gt_bp_mbar: KitIndicator; hrsg_dp_mbar: KitIndicator; stack_c: KitIndicator };
    operation: { load_pct: number; gt_exhaust_c: number; exhaust_flow_kgs: number; ambient_c: number };
  }
  export interface KitMethodData {
    id: string;
    name: string;
    cost_krw: number | null;
    outage_days: number | null;
    indirect_krw: number | null;
    recovery_ratio: number | null;
    recovery_mw: number | null;
  }
  export interface KitCalcData {
    engine: string;
    gt_classes: KitGtClass[];
    default_case: { gt_class: string; gt_bp_mbar: number; hrsg_dp_mbar: number; stack_c: number };
    economics: { price_krw_per_kwh: number; monthly_hours: number; annual_hours: number; target_recovery_mw: number };
    methods: KitMethodData[];
    pinch: {
      design: Record<'HP' | 'IP' | 'LP', { pinch_c: number; approach_c: number }>;
      default_drum_barg: Record<'HP' | 'IP' | 'LP', number>;
      default_data_sections: string[];
    };
    constants: {
      gt_loss_pct_per_mbar: number;
      st_loss_pct_per_c: number;
      outage_margin_ratio: number;
      default_method: string;
      index_weights: { hrsg_dp_mbar: number; gt_bp_mbar: number; stack_c: number };
      public_ref_inh2o: number[];
      pinch_margin_c: number;
    };
  }
  const data: KitCalcData;
  export default data;
}

declare module '@kit/data/checklist.json' {
  export interface KitChecklistItem {
    id: string;
    category: string;
    name: string;
    unit: string;
    reason: string;
    kind: 'design' | 'operation' | 'document';
    required: boolean;
    priority: 'high' | 'medium' | 'low';
    calc_input: string | null;
  }
  export interface KitChecklistData {
    version: string;
    title: string;
    notice: string;
    kinds: Record<string, string>;
    priorities: Record<'high' | 'medium' | 'low', string>;
    supply_states: Record<'not_entered' | 'requested' | 'received' | 'verify_needed' | 'na', string>;
    verify_states: Record<'unverified' | 'in_progress' | 'verified' | 'failed', string>;
    categories: { id: string; name: string }[];
    items: KitChecklistItem[];
  }
  const data: KitChecklistData;
  export default data;
}

declare module '@kit/calc.js' {
  import type { KitCalcData } from '@kit/data/calculator.json';

  export type KitLevel = 'normal' | 'caution' | 'danger';
  export interface KitPressure {
    mbar: number;
    mmh2o: number;
  }
  /** 키트 입력 (inp) — 압력 키는 이름 끝에 단위 (_mbar · _mmh2o · _kpa · _inh2o) */
  export interface KitInput {
    equipment: Record<string, string | number | null | undefined>;
    economics: Record<string, number | null | undefined>;
    methods: {
      id: string;
      name: string;
      cost_krw: number | null;
      outage_days: number | null;
      indirect_krw: number | null;
      recovery_ratio: number | null;
      recovery_mw: number | null;
    }[];
    sections: Partial<
      Record<
        'HP' | 'IP' | 'LP',
        {
          drum_barg: number | null;
          evap_outlet_gas_c: number | null;
          econ_outlet_water_c: number | null;
          pinch_design_c?: number | null;
          approach_design_c?: number | null;
        } | null
      >
    >;
    hp_steam_tph?: number | null;
  }
  export interface KitMethodRow {
    id: string;
    name: string;
    available: boolean;
    missing?: string[];
    message?: string;
    cost_krw?: number;
    outage_days?: number;
    indirect_krw?: number;
    recovery_ratio?: number | null;
    recovered_mw?: number;
    recovery_basis?: 'mw' | 'ratio' | 'target';
    monthly_benefit_krw?: number;
    annual_benefit_krw?: number;
    outage_loss_krw?: number;
    total_investment_krw?: number;
    payback_months?: number | null;
    breakeven_days?: number | null;
    first_month_net_krw?: number;
    annual_net_krw?: number;
  }
  export interface KitCompare {
    rows: KitMethodRow[];
    best_payback_id: string | null;
    max_net_benefit_id: string | null;
  }
  export interface KitIndicatorResult {
    label: string;
    design: number;
    caution: number;
    danger: number;
    min: number;
    max: number;
    value: number;
    level: KitLevel;
  }
  export interface KitResult {
    indicators: { gt_bp_mbar: KitIndicatorResult; hrsg_dp_mbar: KitIndicatorResult; stack_c: KitIndicatorResult };
    overall_level: KitLevel;
    loss: { gt_mw: number; st_mw: number; total_mw: number };
    excess_pressure: KitPressure;
    excess_stack_c: number;
    monthly_loss_krw: number;
    annual_loss_krw: number;
    efficiency: { now: number | null; after: number | null; design: number | null };
    index: { value: number; pressure_part: number; temp_part: number };
    gauge: { value: KitPressure; max: KitPressure; public_ref: KitPressure[] };
    methods: KitCompare;
    kpi: {
      current_bp: KitPressure;
      excess_bp: KitPressure;
      power_loss_mw: number;
      monthly_loss_krw: number;
      expected_recovery_mw: number | null;
      investment_krw: number | null;
      method_name: string | null;
      monthly_benefit_krw: number | null;
      first_month_net_krw: number | null;
      payback_months: number | null;
      breakeven_days: number | null;
    };
    warnings: string[];
    input_warnings: string[];
  }
  export interface KitPinchSection {
    label: string;
    design: { pinch_c: number; approach_c: number };
    level: KitLevel | 'no_data';
    t_sat_c?: number;
    current: { pinch_c: number; approach_c: number } | null;
    message: string;
  }
  export interface KitLossCurve {
    points: { value: KitPressure; excess: KitPressure; loss_mw: number }[];
    current: KitPressure;
    design: KitPressure;
    caution: KitPressure;
    danger: KitPressure;
  }

  export const PRESSURE_UNITS: Record<'mbar' | 'mmh2o' | 'kpa' | 'inh2o', number>;
  export function toMbar(v: number, unit: 'mbar' | 'mmh2o' | 'kpa' | 'inh2o'): number;
  export function fromMbar(mbar: number, unit: 'mbar' | 'mmh2o' | 'kpa' | 'inh2o'): number;
  export function defaultInputs(D: KitCalcData, overrides?: { gt_class?: string }): KitInput;
  export function designInputs(D: KitCalcData, classId?: string): KitInput;
  export function validateInputs(inp: KitInput, D: KitCalcData): { ok: boolean; errors: string[]; warnings: string[] };
  export function calculate(inp: KitInput, D: KitCalcData): KitResult;
  export function compareMethods(inp: KitInput, D: KitCalcData, sortBy?: 'payback' | 'total' | 'net' | 'annual_net' | 'none'): KitCompare;
  export function lossCurve(inp: KitInput, D: KitCalcData, opts?: { param?: 'hrsg_dp' | 'gt_bp'; points?: number }): KitLossCurve;
  export function saturationTempCFromBarg(barg: number): number;
  export function pinchSection(label: 'HP' | 'IP' | 'LP', data: KitInput['sections']['HP'], D: KitCalcData): KitPinchSection;
  export function formatKrw(krw: number | null | undefined): string;
}

declare module '@kit/checklist.js' {
  import type { KitChecklistData, KitChecklistItem } from '@kit/data/checklist.json';

  export type KitSupply = keyof KitChecklistData['supply_states'];
  export type KitVerify = keyof KitChecklistData['verify_states'];
  export interface KitProgressEntry {
    supply?: KitSupply;
    verify?: KitVerify;
    reviewed?: boolean;
    value?: string;
    note?: string;
  }
  export type KitProgress = Record<string, KitProgressEntry>;
  export interface KitRate {
    done: number;
    total: number;
    percent: number;
  }

  export function validateProgress(C: KitChecklistData, prog: KitProgress): { ok: boolean; errors: string[]; warnings: string[] };
  export function kpis(C: KitChecklistData, prog: KitProgress): { received: KitRate; reviewed: KitRate; verified: KitRate; required: KitRate };
  export function byCategory(C: KitChecklistData, prog: KitProgress): ({ id: string; name: string } & KitRate)[];
  export function distribution(
    C: KitChecklistData,
    prog: KitProgress,
  ): { total: number; supply: Record<KitSupply, number>; verify: Record<KitVerify, number>; missing_required: string[] };
  export function isReceived(prog: KitProgress, id: string): boolean;
  export function isSatisfied(prog: KitProgress, id: string): boolean;
  export function priorityLabel(C: KitChecklistData, i: KitChecklistItem, style?: 'level' | 'simple'): string;
  export function emailDraft(C: KitChecklistData, prog: KitProgress, opts?: { ids?: string[] | null; plant?: string; due?: string }): string;
}
