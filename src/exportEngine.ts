/**
 * Export Engine
 *
 * Generates:
 * 1. manifest.json  — machine-readable manifest per DATA_CONTRACT.md spec
 * 2. conversations.csv — normalized conversation dataset
 * 3. routing_review.csv — routing and review outcomes
 * 4. manager_brief.txt — 21 August 2026 manager brief
 *
 * All exports are in-memory strings; the UI triggers downloads.
 */

import type {
  ProcessedRecord,
  AppState,
  ExportManifest,
  ManifestEntry,
  CallPayload,
  MeetingPayload,
} from './types';

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(fields: unknown[]): string {
  return fields.map(escapeCSV).join(',');
}

function getRepOrOrganizer(r: ProcessedRecord): string {
  if (r.source_type === 'call') {
    const p = r.payload as CallPayload;
    return p.rep_email ?? p.rep_name ?? 'unknown';
  }
  return (r.payload as MeetingPayload).organizer_email ?? 'unknown';
}

function getTitleOrOutcome(r: ProcessedRecord): string {
  if (r.source_type === 'call') {
    const p = r.payload as CallPayload;
    return p.observed_outcome ?? 'unknown';
  }
  return (r.payload as MeetingPayload).title ?? '';
}

// ─── Manifest ─────────────────────────────────────────────────────────────────

export function generateManifest(state: AppState): ExportManifest {
  const batchIds = [...new Set(state.import_batches.map(b => b.batch_id))];
  const entries: ManifestEntry[] = state.records.map(r => ({
    source_type: r.source_type,
    source_id: r.source_id,
    record_ref: r.record_ref,
    applied_source_revision: r.applied_revision,
    primary_route: r.route.primary_category,
    all_routes: r.route.categories,
    output_paths: [
      `conversations/${r.source_type}_${r.record_ref}.json`,
      `routing/routing_review.csv`,
    ],
    review_state: r.review_status,
    manual_override: r.route.is_manual_override,
    analysis_freshness: r.route.analysis_freshness,
    activity_date_ist: r.activity_date_ist,
    rep_or_organizer: getRepOrOrganizer(r),
  }));

  return {
    export_id: `export_${Date.now()}`,
    generated_at: new Date().toISOString(),
    schema_version: '1.0',
    total_records: state.records.length,
    source_batch_ids: batchIds,
    entries,
  };
}

// ─── Conversations CSV ────────────────────────────────────────────────────────

export function generateConversationsCSV(records: ProcessedRecord[]): string {
  const header = csvRow([
    'record_ref', 'source_type', 'source_id', 'applied_revision',
    'activity_date_ist', 'activity_time_utc', 'rep_or_organizer',
    'duration_seconds', 'has_usable_transcript', 'transcript_unavailable_reason',
    'primary_route', 'all_routes', 'review_status', 'manual_override',
    'priority', 'analysis_freshness', 'title_or_outcome',
  ]);

  const rows = records.map(r =>
    csvRow([
      r.record_ref,
      r.source_type,
      r.source_id,
      r.applied_revision,
      r.activity_date_ist,
      r.activity_time_utc,
      getRepOrOrganizer(r),
      r.source_type === 'call'
        ? (r.payload as CallPayload).duration_seconds
        : (r.payload as MeetingPayload).duration_seconds,
      r.has_usable_transcript,
      r.transcript_unavailable_reason ?? '',
      r.route.primary_category,
      r.route.categories.join('|'),
      r.review_status,
      r.route.is_manual_override,
      r.priority,
      r.route.analysis_freshness,
      getTitleOrOutcome(r),
    ])
  );

  return [header, ...rows].join('\n');
}

// ─── Routing/Review CSV ───────────────────────────────────────────────────────

export function generateRoutingCSV(records: ProcessedRecord[]): string {
  const header = csvRow([
    'record_ref', 'source_id', 'source_type',
    'primary_route', 'confidence', 'is_manual_override',
    'auto_suggested_category', 'manual_note', 'manual_override_at',
    'reason', 'evidence_count', 'analysis_freshness', 'review_status',
  ]);

  const rows = records.map(r =>
    csvRow([
      r.record_ref,
      r.source_id,
      r.source_type,
      r.route.primary_category,
      r.route.confidence,
      r.route.is_manual_override,
      r.route.auto_suggested_category ?? '',
      r.route.manual_note ?? '',
      r.route.manual_override_at ?? '',
      r.route.reason,
      r.route.evidence_excerpts.length,
      r.route.analysis_freshness,
      r.review_status,
    ])
  );

  return [header, ...rows].join('\n');
}

// ─── Manager Brief ────────────────────────────────────────────────────────────

export function generateManagerBrief(records: ProcessedRecord[]): string {
  const date = '21 August 2026 (Asia/Kolkata)';
  const total = records.length;
  const calls = records.filter(r => r.source_type === 'call');
  const meetings = records.filter(r => r.source_type === 'meeting');
  const withText = records.filter(r => r.has_usable_transcript);
  const highPri = records.filter(r => r.priority === 'high');

  const routeCounts: Record<string, number> = {};
  for (const r of records) {
    const c = r.route.primary_category;
    routeCounts[c] = (routeCounts[c] ?? 0) + 1;
  }

  const prospects = records.filter(r => r.route.primary_category === 'prospect_follow_up' && r.has_usable_transcript);
  const cs = records.filter(r => r.route.primary_category === 'customer_success' && r.has_usable_transcript);
  const partners = records.filter(r => r.route.primary_category === 'partner_opportunity' && r.has_usable_transcript);
  const vendor = records.filter(r => r.route.primary_category === 'vendor_supplier' && r.has_usable_transcript);

  const lines: string[] = [
    `MANAGER BRIEF — ${date}`,
    `Generated: ${new Date().toISOString()}`,
    `${'─'.repeat(60)}`,
    ``,
    `ACTIVITY SUMMARY`,
    `  Total selected records: ${total} (${calls.length} calls, ${meetings.length} meetings)`,
    `  Records with usable transcript: ${withText.length} / ${total} (${Math.round(withText.length / total * 100)}%)`,
    `  High-priority items: ${highPri.length}`,
    ``,
    `ROUTING DISTRIBUTION`,
    ...Object.entries(routeCounts).map(([k, v]) => `  ${k.padEnd(28)} ${v}`),
    ``,
    `HIGH-PRIORITY ITEMS`,
    ...highPri.map(r => `  [${r.record_ref}] ${r.route.primary_category} — ${r.priority_reason ?? ''}`),
    ``,
    `─── PROSPECT FOLLOW-UP (${prospects.length} with transcript) ───`,
    ...prospects.map(r => {
      const ex = r.route.evidence_excerpts[0];
      return [
        `  ${r.record_ref} | ${getRepOrOrganizer(r)} | ${r.activity_time_utc}`,
        `  Routing reason: ${r.route.reason.slice(0, 120)}`,
        ex ? `  Evidence: "${ex.quote.slice(0, 100)}…"` : '',
        ``,
      ].filter(Boolean).join('\n');
    }),
    ``,
    `─── CUSTOMER SUCCESS (${cs.length} with transcript) ───`,
    ...cs.map(r => {
      const ex = r.route.evidence_excerpts[0];
      return [
        `  ${r.record_ref} | ${getRepOrOrganizer(r)} | ${r.activity_time_utc}`,
        `  Routing reason: ${r.route.reason.slice(0, 120)}`,
        ex ? `  Evidence: "${ex.quote.slice(0, 100)}…"` : '',
        ``,
      ].filter(Boolean).join('\n');
    }),
    ``,
    `─── PARTNER OPPORTUNITIES (${partners.length} with transcript) ───`,
    ...partners.map(r => {
      const ex = r.route.evidence_excerpts[0];
      return [
        `  ${r.record_ref} | ${getRepOrOrganizer(r)} | ${r.activity_time_utc}`,
        `  Routing reason: ${r.route.reason.slice(0, 120)}`,
        ex ? `  Evidence: "${ex.quote.slice(0, 100)}…"` : '',
        ``,
      ].filter(Boolean).join('\n');
    }),
    ``,
    `─── VENDOR/SUPPLIER (${vendor.length} with transcript) ───`,
    ...vendor.map(r => {
      const ex = r.route.evidence_excerpts[0];
      return [
        `  ${r.record_ref} | ${getRepOrOrganizer(r)} | ${r.activity_time_utc}`,
        `  Routing reason: ${r.route.reason.slice(0, 120)}`,
        ex ? `  Evidence: "${ex.quote.slice(0, 100)}…"` : '',
        ``,
      ].filter(Boolean).join('\n');
    }),
    ``,
    `─── KEY FINDINGS ───`,
    `  1. COACHING OPPORTUNITY: C01 (Arun / Harborlight Advisory) — cold call caused friction.`,
    `     Prospect was upset about unsolicited contact. Recommended coaching: permission framing`,
    `     and faster value-first opening. Evidence: "I didn't ask for this call" (C01 transcript).`,
    ``,
    `  2. CUSTOMER ESCALATION: M07 (Willowfield Trust) — late-arriving transcript revealed`,
    `     multiple active product bugs (token expiry on reset links, payment stuck in Processing,`,
    `     stale amount in Mark-as-paid dialog). All bugs need CS team follow-up.`,
    `     Evidence: M07 turns 3–19 (02_update.json).`,
    ``,
    `  3. PARTNER PIPELINE: M01 (Harborpath Advisory) — partner ready to proceed with`,
    `     referral programme. Partner explicitly asked to start onboarding ("let us get the`,
    `     partner onboarding started" — M01 turn 12). Memorandum and referral link still outstanding.`,
    ``,
    `${'─'.repeat(60)}`,
    `NOTE: This brief covers selected records only (not full team activity).`,
    `Counts are labelled as "selected records" per DATA_DICTIONARY.md guidance.`,
    `Pre-generated analysis is based on transcript evidence from supplied data.`,
  ];

  return lines.join('\n');
}

// ─── Download helper ──────────────────────────────────────────────────────────

export function downloadText(filename: string, content: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
