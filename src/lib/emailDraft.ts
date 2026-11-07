import type { Lang } from '@/types';
import { CHECKLIST_CATEGORIES, CHECKLIST_CATEGORY_LABEL, type ChecklistItem } from '@/data/checklistItems';
import { VALIDATION_SCENARIO } from '@/data/validationScenario';

const { daysBefore: PRE, daysAfter: POST } = VALIDATION_SCENARIO;

/**
 * 자료 요청 이메일 초안 생성 — 순수 함수.
 * 실제 수신자 주소를 만들지 않고 자리표시자를 남긴다. 발송 기능은 없다.
 */
export interface EmailOptions {
  /** 고객사/발전소명 — 비어 있으면 자리표시자 */
  clientName?: string;
  /** 항목별 단위·측정 조건 (체크리스트 메타데이터) */
  meta?: Record<string, { unit?: string; condition?: string }>;
  /** 항목별 비고 — 추가 설명으로 포함 */
  notes?: Record<string, string>;
}

const cell = (v: string) => v.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim() || '-';

/** '요청 필요' 항목 마크다운 표 (가이드 §2.4 이메일 초안 생성기) */
export function buildItemsTable(items: ChecklistItem[], lang: Lang, opts: EmailOptions = {}): string[] {
  const ko = lang === 'ko';
  const head = ko
    ? ['No', 'ID', '분류', '요청 항목', '형식', '필요 단위', '측정 조건', '추가 설명']
    : ['No', 'ID', 'Category', 'Item', 'Format', 'Unit', 'Measurement condition', 'Note'];
  const cats = CHECKLIST_CATEGORIES;
  const sorted = cats.flatMap((c) => items.filter((i) => i.category === c));
  return [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...sorted.map((i, idx) =>
      `| ${[
        String(idx + 1),
        i.id,
        CHECKLIST_CATEGORY_LABEL[i.category][lang],
        i.name[lang],
        i.format[lang],
        opts.meta?.[i.id]?.unit ?? '',
        opts.meta?.[i.id]?.condition ?? '',
        opts.notes?.[i.id] ?? '',
      ]
        .map(cell)
        .join(' | ')} |`,
    ),
  ];
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 초안 본문(마크다운 표 포함) → 메일 클라이언트에 붙여 넣을 HTML */
export function emailBodyToHtml(body: string): string {
  const out: string[] = [];
  const rows: string[][] = [];
  const flush = () => {
    if (rows.length === 0) return;
    const [h, ...rest] = rows;
    const td = 'style="border:1px solid #cbd5e1;padding:4px 8px"';
    out.push(
      `<table style="border-collapse:collapse;font-size:13px"><thead><tr>${h.map((c) => `<th ${td}>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rest
        .map((r) => `<tr>${r.map((c) => `<td ${td}>${esc(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`,
    );
    rows.length = 0;
  };
  for (const line of body.split('\n')) {
    if (/^\|.*\|$/.test(line.trim())) {
      if (/^\|(\s*-+\s*\|)+$/.test(line.trim())) continue;
      rows.push(line.trim().slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|')));
      continue;
    }
    flush();
    out.push(line.trim() === '' ? '<br>' : `<div>${esc(line)}</div>`);
  }
  flush();
  return out.join('\n');
}

export function buildRequestEmail(items: ChecklistItem[], lang: Lang, opts: EmailOptions = {}): { subject: string; body: string } {
  const ko = lang === 'ko';
  const client = opts.clientName?.trim() || (ko ? '[고객사/발전소명]' : '[client / plant name]');
  const lines = buildItemsTable(items, lang, opts);
  lines.push('');

  if (ko) {
    return {
      subject: `[HRSG 협력 프로젝트] ${client} 운전·설계 데이터 자료 요청드립니다`,
      body: [
        '[수신자 성함/직함]님께,',
        '',
        '안녕하십니까. 폐열회수단 × 클라우드라 협력 프로젝트를 진행하고 있는 [보내는 사람 이름 / 소속]입니다.',
        '항상 프로젝트에 협조해 주셔서 감사드립니다.',
        '',
        '현재 저희는 HRSG Maintenance Decision Support Platform 프로토타입을 개발하고 있으며, 화면의 수치는 모두 시연용 가상 데이터로 구성되어 있습니다. 성능 저하 및 세정 경제성 분석을 실제 설비 조건에 맞게 검토하기 위해 아래 자료를 요청드리고자 합니다.',
        '',
        `■ 대상: ${client}`,
        '',
        `■ 요청 자료 (${items.length}건)`,
        ...lines,
        '■ 단위 및 기간 관련 안내',
        '  - 각 자료의 단위(예: mmH₂O 또는 mbar, °C, MW)와 측정 위치를 함께 표기해 주시면 감사하겠습니다.',
        `  - 시계열 자료는 가능한 범위에서 최근 12개월 이상, 세정 전후 자료는 세정 전 ${PRE}일·세정 후 ${POST}일 이상을 희망합니다.`,
        '  - 측정 주기(예: 1시간 평균)와 결측·이상값 처리 여부를 알려주시면 분석에 도움이 됩니다.',
        '  - 제공이 어려운 항목이나 보안상 가공이 필요한 항목은 말씀해 주시면 범위를 조정하겠습니다.',
        '',
        '■ 자료 활용 목적',
        '  - 프로토타입의 가상 데이터와 임시 가정값을 실제 값으로 교체하고 계산 결과를 검증하는 데에만 사용합니다.',
        '  - 제공해 주신 자료는 프로젝트 내부 분석 목적으로만 활용하며 외부에 공개하지 않습니다.',
        '',
        '바쁘신 와중에 번거로운 요청을 드려 죄송합니다. 자료 준비 일정이나 형식에 대해 궁금하신 점이 있으시면 편하게 연락 주십시오.',
        '',
        '감사합니다.',
        '',
        '[보내는 사람 이름]',
        '[소속 / 연락처]',
      ].join('\n'),
    };
  }

  return {
    subject: `[HRSG joint project] Request for operating and design data — ${client}`,
    body: [
      'Dear [recipient name / title],',
      '',
      'I hope this message finds you well. I am [sender name / affiliation], working on the 폐열회수단 × 클라우드라 joint project.',
      'Thank you for your continued support.',
      '',
      'We are developing a prototype of the HRSG Maintenance Decision Support Platform, and all figures on screen are currently mock data. To review performance degradation and cleaning economics against actual unit conditions, we would like to request the following data.',
      '',
      `■ Target: ${client}`,
      '',
      `■ Requested data (${items.length} items)`,
      ...lines,
      '■ Units and periods',
      '  - Please indicate the unit (e.g., mmH₂O or mbar, °C, MW) and measurement location for each item.',
      `  - Where possible, we would appreciate 12+ months of time series, and at least ${PRE} days before and ${POST} days after cleaning.`,
      '  - Sampling interval (e.g., hourly average) and handling of missing/abnormal values would help our analysis.',
      '  - If any item is difficult to share or needs masking for confidentiality, please let us know and we will adjust the scope.',
      '',
      '■ Purpose of use',
      '  - The data will be used only to replace the prototype’s mock values and provisional assumptions and to validate its calculations.',
      '  - It will be used solely for internal project analysis and will not be disclosed externally.',
      '',
      'We appreciate your time. Please feel free to contact us with any questions about schedule or format.',
      '',
      'Best regards,',
      '',
      '[Sender name]',
      '[Affiliation / contact]',
    ].join('\n'),
  };
}
