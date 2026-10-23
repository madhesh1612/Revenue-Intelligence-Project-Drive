/**
 * Import Engine
 *
 * Implements the DATA_CONTRACT.md rules:
 * 1. Identity = (source_type, source_id). Names, record_ref, array positions are NOT identity.
 * 2. Revisions: same-or-older revisions are ignored. Higher revision replaces entire payload.
 * 3. Manual route overrides survive source updates.
 * 4. Analysis is marked stale when source text changes after a manual analysis was done.
 * 5. State persists to localStorage across browser refreshes.
 */

import type {
  ImportBatch,
  ProcessedRecord,
  AppState,
  ImportBatchRecord,
  SourceRecord,
  RouteDecision,
  ReviewHistoryEntry,
  MeetingTranscriptPayload,
  CallPayload,
} from './types';
import { routeRecord, assignPriority, getActivityDate } from './routing';

const STORAGE_KEY = 'rix_app_state_v1';

function normalizeAnalysisFreshness(value: string | undefined): RouteDecision['analysis_freshness'] {
  if (value === 'current' || value === 'stale' || value === 'pending_review') {
    return value;
  }
  return 'current';
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      return parsed;
    }
  } catch {
    // corrupted storage — start fresh
  }
  return { records: [], import_batches: [] };
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not persist state to localStorage:', e);
  }
}

export function clearState(): AppState {
  localStorage.removeItem(STORAGE_KEY);
  return { records: [], import_batches: [] };
}

// ─── Transcript availability ───────────────────────────────────────────────────

function getTranscriptInfo(record: SourceRecord): {
  has_usable: boolean;
  unavailable_reason?: string;
} {
  if (record.source_type === 'call') {
    const p = record.payload as CallPayload;
    const has_usable = typeof p.transcript === 'string' && p.transcript.trim().length > 10;
    return { has_usable };
  }
  const tp = record.transcript_payload as MeetingTranscriptPayload | null;
  if (!tp) return { has_usable: false, unavailable_reason: 'No transcript payload' };
  if (tp.turns.length === 0) {
    return { has_usable: false, unavailable_reason: tp.unavailable_reason ?? 'Empty turns array' };
  }
  return { has_usable: true };
}

// ─── Process a single source record into a ProcessedRecord ────────────────────

function processNewRecord(
  sourceRecord: SourceRecord,
  revision: number,
  now: string,
  batchId: string
): ProcessedRecord {
  const { date_ist, time_utc } = getActivityDate(sourceRecord);
  const { has_usable, unavailable_reason } = getTranscriptInfo(sourceRecord);
  const route = routeRecord(sourceRecord, revision);
  const { priority, priority_reason } = assignPriority(sourceRecord, route);

  const historyEntry: ReviewHistoryEntry = {
    at: now,
    action: 'imported',
    actor: 'system',
    note: `Imported from batch ${batchId} (revision ${revision})`,
  };

  return {
    source_type: sourceRecord.source_type,
    source_id: sourceRecord.source_id,
    record_ref: sourceRecord.record_ref,
    applied_revision: revision,
    payload: sourceRecord.payload,
    transcript_payload: sourceRecord.transcript_payload,
    has_usable_transcript: has_usable,
    transcript_unavailable_reason: unavailable_reason,
    activity_date_ist: date_ist,
    activity_time_utc: time_utc,
    route,
    review_status: 'pending',
    review_history: [historyEntry],
    priority,
    priority_reason,
    first_imported_at: now,
    last_updated_at: now,
    import_batch_id: batchId,
  };
}

// ─── Check if the transcript text changed between revisions ───────────────────

function transcriptChanged(existing: ProcessedRecord, incoming: SourceRecord): boolean {
  if (incoming.source_type === 'call') {
    const oldT = (existing.payload as CallPayload).transcript;
    const newT = (incoming.payload as CallPayload).transcript;
    return oldT !== newT;
  }
  // meeting: compare turns length and first turn text
  const oldTurns = (existing.transcript_payload as MeetingTranscriptPayload | null)?.turns ?? [];
  const newTurns = (incoming.transcript_payload as MeetingTranscriptPayload | null)?.turns ?? [];
  if (oldTurns.length !== newTurns.length) return true;
  if (oldTurns.length > 0 && newTurns.length > 0) {
    return oldTurns[0].text !== newTurns[0].text;
  }
  return false;
}

// ─── Apply an update to an existing record ────────────────────────────────────

function applyUpdate(
  existing: ProcessedRecord,
  incoming: SourceRecord,
  revision: number,
  now: string,
  batchId: string
): { updated: ProcessedRecord; changed: boolean } {
  const textChanged = transcriptChanged(existing, incoming);
  const { has_usable, unavailable_reason } = getTranscriptInfo(incoming);

  // Re-run auto routing with new source data
  const newAutoRoute = routeRecord(incoming, revision);

  // If manual override exists, preserve it but mark analysis stale if text changed
  let route: RouteDecision;
  if (existing.route.is_manual_override) {
    route = {
      ...existing.route,
      analysis_revision: revision,
      analysis_freshness: textChanged ? 'stale' : normalizeAnalysisFreshness(existing.route.analysis_freshness),
      // Record what auto would suggest now
      auto_suggested_category: newAutoRoute.primary_category,
    } satisfies RouteDecision;
  } else {
    // No manual override — apply new auto route
    route = {
      ...newAutoRoute,
      analysis_freshness: 'current',
    };
  }

  const { priority, priority_reason } = assignPriority(incoming, route);
  const { date_ist, time_utc } = getActivityDate(incoming);

  const historyEntry: ReviewHistoryEntry = {
    at: now,
    action: 'source_updated',
    actor: 'system',
    note: `Source revision ${revision} applied from batch ${batchId}${textChanged ? '. Transcript content changed.' : ''}`,
  };

  const updated: ProcessedRecord = {
    ...existing,
    record_ref: incoming.record_ref, // keep current ref
    applied_revision: revision,
    payload: incoming.payload,
    transcript_payload: incoming.transcript_payload,
    has_usable_transcript: has_usable,
    transcript_unavailable_reason: unavailable_reason,
    activity_date_ist: date_ist,
    activity_time_utc: time_utc,
    route,
    priority,
    priority_reason,
    last_updated_at: now,
    review_history: [...existing.review_history, historyEntry],
  };

  return { updated, changed: true };
}

// ─── Main import function ─────────────────────────────────────────────────────

export interface ImportResult {
  state: AppState;
  batch_record: ImportBatchRecord;
  created: number;
  updated: number;
  skipped: number;
  invalid: number;
  errors: string[];
}

export function importBatch(
  currentState: AppState,
  batch: ImportBatch,
  sourceFile: string
): ImportResult {
  const now = new Date().toISOString();
  const errors: string[] = [];
  let created = 0, updated = 0, skipped = 0, invalid = 0;

  // Build lookup map by (source_type, source_id)
  const recordMap = new Map<string, ProcessedRecord>();
  for (const r of currentState.records) {
    recordMap.set(`${r.source_type}:${r.source_id}`, r);
  }

  const newRecordsList: ProcessedRecord[] = [];

  for (const sourceRecord of batch.records) {
    // Validate required fields
    if (!sourceRecord.source_type || !sourceRecord.source_id) {
      errors.push(`Record ${sourceRecord.record_ref ?? '?'}: missing source_type or source_id`);
      invalid++;
      continue;
    }
    if (sourceRecord.source_type !== 'call' && sourceRecord.source_type !== 'meeting') {
      errors.push(`Record ${sourceRecord.record_ref}: unknown source_type "${sourceRecord.source_type}"`);
      invalid++;
      continue;
    }

    const key = `${sourceRecord.source_type}:${sourceRecord.source_id}`;
    const existing = recordMap.get(key);

    if (!existing) {
      // New record
      try {
        const processed = processNewRecord(sourceRecord, batch.revision, now, batch.batch_id);
        newRecordsList.push(processed);
        recordMap.set(key, processed);
        created++;
      } catch (e) {
        errors.push(`Record ${sourceRecord.record_ref}: processing error — ${e}`);
        invalid++;
      }
    } else {
      // Existing record
      if (batch.revision <= existing.applied_revision) {
        // Same or older revision — skip (idempotent)
        skipped++;
        newRecordsList.push(existing); // keep as-is
        continue;
      }
      // Higher revision — apply update
      try {
        const { updated: updatedRecord } = applyUpdate(existing, sourceRecord, batch.revision, now, batch.batch_id);
        newRecordsList.push(updatedRecord);
        recordMap.set(key, updatedRecord);
        updated++;
      } catch (e) {
        errors.push(`Record ${sourceRecord.record_ref}: update error — ${e}`);
        invalid++;
        newRecordsList.push(existing);
      }
    }
  }

  // Records not mentioned in this batch stay as-is (no deletion events)
  for (const [key, r] of recordMap.entries()) {
    if (!newRecordsList.find(nr => `${nr.source_type}:${nr.source_id}` === key)) {
      newRecordsList.push(r);
    }
  }

  const batchRecord: ImportBatchRecord = {
    batch_id: batch.batch_id,
    revision: batch.revision,
    imported_at: now,
    exported_at: batch.exported_at,
    source_file: sourceFile,
    total_records: batch.records.length,
    created,
    updated,
    skipped,
    invalid,
    errors,
  };

  const newState: AppState = {
    records: newRecordsList,
    import_batches: [...currentState.import_batches, batchRecord],
    last_export_at: currentState.last_export_at,
  };

  return { state: newState, batch_record: batchRecord, created, updated, skipped, invalid, errors };
}

// ─── Manual route override ────────────────────────────────────────────────────

export function applyManualOverride(
  state: AppState,
  sourceId: string,
  sourceType: string,
  newCategory: import('./types').RouteCategory,
  note: string,
  actor: string = 'manager'
): AppState {
  const now = new Date().toISOString();
  const records = state.records.map(r => {
    if (r.source_id !== sourceId || r.source_type !== sourceType) return r;

    const historyEntry: ReviewHistoryEntry = {
      at: now,
      action: 'manual_route_override',
      actor,
      note,
      previous_route: r.route.primary_category,
      new_route: newCategory,
    };

    const updatedRoute: RouteDecision = {
      ...r.route,
      primary_category: newCategory,
      categories: [newCategory],
      is_manual_override: true,
      manual_note: note,
      manual_override_at: now,
      auto_suggested_category: r.route.is_manual_override
        ? r.route.auto_suggested_category
        : r.route.primary_category,
      analysis_freshness: 'current',
    };

    const updatedRecord: ProcessedRecord = {
      ...r,
      route: updatedRoute,
      last_updated_at: now,
      review_history: [...r.review_history, historyEntry],
    };

    return updatedRecord;
  });

  return { ...state, records };
}

// ─── Mark as reviewed ─────────────────────────────────────────────────────────

export function markReviewed(
  state: AppState,
  sourceId: string,
  sourceType: string,
  note?: string
): AppState {
  const now = new Date().toISOString();
  const records = state.records.map(r => {
    if (r.source_id !== sourceId || r.source_type !== sourceType) return r;
    const historyEntry: ReviewHistoryEntry = {
      at: now,
      action: 'marked_reviewed',
      actor: 'manager',
      note,
    };
    const updatedRecord: ProcessedRecord = {
      ...r,
      review_status: 'reviewed' as const,
      last_updated_at: now,
      review_history: [...r.review_history, historyEntry],
    };

    return updatedRecord;
  });
  return { ...state, records };
}

// ─── Reset manual override ────────────────────────────────────────────────────

export function resetManualOverride(
  state: AppState,
  sourceId: string,
  sourceType: string
): AppState {
  const now = new Date().toISOString();
  const records = state.records.map(r => {
    if (r.source_id !== sourceId || r.source_type !== sourceType) return r;
    // Re-run auto routing
    const sourceRecord: SourceRecord = {
      record_ref: r.record_ref,
      source_type: r.source_type,
      source_id: r.source_id,
      payload: r.payload,
      transcript_payload: r.transcript_payload,
    };
    const newRoute = routeRecord(sourceRecord, r.applied_revision);
    const { priority, priority_reason } = assignPriority(sourceRecord, newRoute);
    const historyEntry: ReviewHistoryEntry = {
      at: now,
      action: 'override_reset',
      actor: 'manager',
      note: 'Manual override removed; routing reverted to automated decision.',
    };
    const updatedRecord: ProcessedRecord = {
      ...r,
      route: { ...newRoute, analysis_freshness: 'current' } satisfies RouteDecision,
      priority,
      priority_reason,
      last_updated_at: now,
      review_history: [...r.review_history, historyEntry],
    };

    return updatedRecord;
  });
  return { ...state, records };
}
