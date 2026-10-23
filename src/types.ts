// ─── Source data types (mirror the JSON schema) ───────────────────────────────

export interface CallPayload {
  id: string;
  external_call_id: string;
  workspace_slug: string;
  rep_email: string | null;
  rep_name: string | null;
  rep_user_id: string | null;
  direction: 'inbound' | 'outbound';
  direction_raw: string;
  from_number: string | null;
  to_number: string | null;
  started_at: string; // ISO timestamp
  duration_seconds: number;
  talk_time_seconds: number | null;
  speaker_count: number | null;
  segment_count: number | null;
  is_connected: boolean | null;
  is_conversation: boolean | null;
  observed_outcome: string | null;
  classification_reason: null; // always null in this package
  classification_status: string | null;
  is_campaign_call: boolean | null;
  first_dial_ever: boolean | null;
  first_connect_ever: boolean | null;
  prior_dials_ever: number | null;
  prior_connects_ever: number | null;
  summary: null; // withheld
  summary_status: string | null;
  transcript: string | null;
}

export interface MeetingTurn {
  speaker: string;
  starts_at_seconds: number;
  timecode: string;
  text: string;
}

export interface MeetingTranscriptPayload {
  meeting_id: string;
  turns: MeetingTurn[];
  unavailable_reason: string | null;
}

export interface MeetingPayload {
  id: string;
  title: string;
  starts_at: string; // ISO timestamp
  ends_at: string;
  duration_seconds: number;
  provider: string;
  join_url: string;
  organizer_email: string | null;
  attendee_count: number | null;
  recording_status: 'recorded' | 'cancelled' | 'not_scheduled';
  recording_detail: string | null;
  recording_id: string | null;
  has_transcript: boolean;
  has_video: boolean;
  summary: null;
  summary_status: string | null;
  redacted: boolean;
}

export interface SourceRecord {
  record_ref: string;
  source_type: 'call' | 'meeting';
  source_id: string;
  payload: CallPayload | MeetingPayload;
  transcript_payload: MeetingTranscriptPayload | null;
}

export interface ImportBatch {
  batch_id: string;
  revision: number;
  exported_at: string;
  records: SourceRecord[];
}

// ─── Application-level types ───────────────────────────────────────────────────

export type RouteCategory =
  | 'prospect_follow_up'      // Active prospect, clear next step needed
  | 'partner_opportunity'     // Partnership / referral discussion
  | 'customer_success'        // Existing customer support / migration
  | 'internal_operations'     // Internal SpendNest meetings / training
  | 'vendor_supplier'         // SpendNest vendor / supplier evaluation
  | 'no_connection'           // Background calls (voicemail / unresponsive)
  | 'no_transcript'           // Record without usable conversation text
  | 'human_review_needed';    // Ambiguous — route needs human decision

export interface RouteDecision {
  categories: RouteCategory[];
  primary_category: RouteCategory;
  reason: string;
  evidence_excerpts: EvidenceExcerpt[];
  confidence: 'high' | 'medium' | 'low';
  is_manual_override: boolean;
  manual_note?: string;
  manual_override_at?: string; // ISO timestamp
  auto_suggested_category?: RouteCategory; // original before override
  analysis_revision: number;   // which source revision produced this analysis
  analysis_freshness: 'current' | 'stale' | 'pending_review';
}

export interface EvidenceExcerpt {
  source_id: string;
  record_ref: string;
  turn_number?: number;    // 1-based, for meetings
  quote: string;
  context?: string;
}

export type ReviewStatus = 'pending' | 'reviewed' | 'needs_attention';

export interface ReviewHistoryEntry {
  at: string;
  action: string;
  actor: string; // 'system' | manager email
  note?: string;
  previous_route?: RouteCategory;
  new_route?: RouteCategory;
}

export interface ProcessedRecord {
  // Identity
  source_type: 'call' | 'meeting';
  source_id: string;
  record_ref: string;

  // Source data (latest applied revision)
  applied_revision: number;
  payload: CallPayload | MeetingPayload;
  transcript_payload: MeetingTranscriptPayload | null;

  // Derived
  has_usable_transcript: boolean;
  transcript_unavailable_reason?: string;
  activity_date_ist: string; // YYYY-MM-DD in Asia/Kolkata
  activity_time_utc: string; // ISO

  // Routing (candidate-derived, separate from source fields)
  route: RouteDecision;
  review_status: ReviewStatus;
  review_history: ReviewHistoryEntry[];
  priority: 'high' | 'medium' | 'low';
  priority_reason?: string;

  // Import tracking
  first_imported_at: string;
  last_updated_at: string;
  import_batch_id: string;
}

export interface ImportBatchRecord {
  batch_id: string;
  revision: number;
  imported_at: string;
  exported_at: string;
  source_file: string;
  total_records: number;
  created: number;
  updated: number;
  skipped: number;
  invalid: number;
  errors: string[];
}

export interface AppState {
  records: ProcessedRecord[];
  import_batches: ImportBatchRecord[];
  last_export_at?: string;
}

// ─── Dashboard metric types ────────────────────────────────────────────────────

export interface DashboardMetrics {
  total_records: number;
  total_calls: number;
  total_meetings: number;
  records_with_usable_transcript: number;
  records_without_usable_transcript: number;
  transcript_coverage_pct: number;
  call_transcript_coverage_pct: number;
  meeting_transcript_coverage_pct: number;
  connected_calls: number;
  connected_call_rate_pct: number;        // denominator: calls with non-null is_connected
  connected_call_unknown_count: number;
  conversations: number;                  // is_conversation=true
  awaiting_review: number;
  routing_distribution: Record<RouteCategory, number>;
  rep_activity: RepActivity[];
  high_priority_count: number;
}

export interface RepActivity {
  rep_email: string;
  rep_name: string;
  call_count: number;
  meeting_organizer_count: number;
  connected_calls: number;
  transcript_calls: number;
  routes: Partial<Record<RouteCategory, number>>;
}

// ─── Export manifest types ─────────────────────────────────────────────────────

export interface ManifestEntry {
  source_type: string;
  source_id: string;
  record_ref: string;
  applied_source_revision: number;
  primary_route: RouteCategory;
  all_routes: RouteCategory[];
  output_paths: string[];
  review_state: ReviewStatus;
  manual_override: boolean;
  analysis_freshness: string;
  activity_date_ist: string;
  rep_or_organizer: string;
}

export interface ExportManifest {
  export_id: string;
  generated_at: string;
  schema_version: '1.0';
  total_records: number;
  source_batch_ids: string[];
  entries: ManifestEntry[];
}
