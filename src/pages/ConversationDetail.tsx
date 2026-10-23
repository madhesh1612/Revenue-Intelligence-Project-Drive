import { useState } from 'react';
import {
  ArrowLeft, Phone, Video, FileText, AlertCircle, CheckCircle2,
  Clock, Edit3, RotateCcw, Save, X, ChevronDown, ChevronUp,
  Info, Shield, History,
} from 'lucide-react';
import type { ProcessedRecord, RouteCategory, MeetingTranscriptPayload, CallPayload, MeetingPayload } from '../types';

const ROUTE_LABELS: Record<RouteCategory, string> = {
  prospect_follow_up: 'Prospect Follow-up',
  partner_opportunity: 'Partner Opportunity',
  customer_success: 'Customer Success',
  internal_operations: 'Internal / Ops',
  vendor_supplier: 'Vendor / Supplier',
  no_connection: 'No Connection',
  no_transcript: 'No Transcript',
  human_review_needed: 'Human Review',
};

const ALL_ROUTES: RouteCategory[] = [
  'prospect_follow_up', 'partner_opportunity', 'customer_success',
  'internal_operations', 'vendor_supplier', 'no_connection', 'no_transcript', 'human_review_needed',
];

const ROUTE_BADGE_CLASS: Record<RouteCategory, string> = {
  prospect_follow_up: 'badge-blue',
  partner_opportunity: 'badge-purple',
  customer_success: 'badge-green',
  internal_operations: 'badge-gray',
  vendor_supplier: 'badge-yellow',
  no_connection: 'badge-gray',
  no_transcript: 'badge-gray',
  human_review_needed: 'badge-red',
};

interface Props {
  record: ProcessedRecord;
  allRecords: ProcessedRecord[];
  onBack: () => void;
  onManualOverride: (sourceId: string, sourceType: string, cat: RouteCategory, note: string) => void;
  onMarkReviewed: (sourceId: string, sourceType: string, note?: string) => void;
  onResetOverride: (sourceId: string, sourceType: string) => void;
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/20 transition-colors"
      >
        <div className="flex items-center gap-2 font-semibold text-gray-200">
          <Icon className="w-4 h-4 text-brand-400" />
          {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {open && <div className="p-4 pt-0 border-t border-gray-800/50">{children}</div>}
    </div>
  );
}

export function ConversationDetail({
  record, onBack, onManualOverride, onMarkReviewed, onResetOverride
}: Props) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteCategory>(record.route.primary_category);
  const [overrideNote, setOverrideNote] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  const callP = record.source_type === 'call' ? record.payload as CallPayload : null;
  const meetP = record.source_type === 'meeting' ? record.payload as MeetingPayload : null;
  const transcriptP = record.transcript_payload as MeetingTranscriptPayload | null;

  const handleSaveOverride = () => {
    if (!overrideNote.trim()) return;
    onManualOverride(record.source_id, record.source_type, selectedRoute, overrideNote);
    setOverrideOpen(false);
    setOverrideNote('');
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
    } catch { return iso; }
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="btn-secondary py-1.5 px-3">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {record.source_type === 'call'
              ? <Phone className="w-5 h-5 text-blue-400" />
              : <Video className="w-5 h-5 text-purple-400" />}
            <h1 className="text-xl font-bold text-white">
              {record.source_type === 'meeting' ? meetP?.title : `${callP?.direction} call · ${callP?.observed_outcome}`}
            </h1>
            <span className={`badge font-mono ${record.source_type === 'call' ? 'badge-blue' : 'badge-purple'}`}>
              {record.record_ref}
            </span>
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {formatTime(record.activity_time_utc)} (IST) · {record.source_id}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {record.priority === 'high' && <span className="badge-red"><AlertCircle className="w-3 h-3" />high priority</span>}
          {record.review_status === 'reviewed'
            ? <span className="badge-green"><CheckCircle2 className="w-3 h-3" />reviewed</span>
            : <span className="badge-yellow"><Clock className="w-3 h-3" />pending</span>}
          {record.route.is_manual_override && (
            <span className="badge-orange"><Shield className="w-3 h-3" />manual override</span>
          )}
        </div>
      </div>

      {/* Source Metadata */}
      <Section title="Source Metadata" icon={Info}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {callP && <>
            <div><span className="text-gray-500">Source type</span><div className="text-gray-200 font-mono text-xs">call</div></div>
            <div><span className="text-gray-500">Rep email</span><div className="text-gray-200 text-xs">{callP.rep_email ?? '—'}</div></div>
            <div><span className="text-gray-500">Rep name</span><div className="text-gray-200">{callP.rep_name ?? '—'}</div></div>
            <div><span className="text-gray-500">Direction</span><div className="text-gray-200">{callP.direction}</div></div>
            <div><span className="text-gray-500">Duration</span><div className="text-gray-200">{callP.duration_seconds}s</div></div>
            <div><span className="text-gray-500">Talk time</span><div className="text-gray-200">{callP.talk_time_seconds ?? '—'}s</div></div>
            <div><span className="text-gray-500">Is connected</span><div className={callP.is_connected === true ? 'text-green-400' : callP.is_connected === false ? 'text-red-400' : 'text-gray-500'}>{String(callP.is_connected ?? 'null')}</div></div>
            <div><span className="text-gray-500">Is conversation</span><div className={callP.is_conversation ? 'text-green-400' : 'text-gray-400'}>{String(callP.is_conversation ?? 'null')}</div></div>
            <div><span className="text-gray-500">Outcome</span><div className="text-gray-200">{callP.observed_outcome ?? '—'}</div></div>
            <div><span className="text-gray-500">Campaign call</span><div className="text-gray-200">{String(callP.is_campaign_call ?? 'null')}</div></div>
            <div><span className="text-gray-500">Speaker count</span><div className="text-gray-200">{callP.speaker_count ?? '—'}</div></div>
            <div><span className="text-gray-500">Summary status</span><div className="text-gray-200">{callP.summary_status ?? '—'} (body withheld)</div></div>
            <div><span className="text-gray-500">Workspace</span><div className="text-gray-200 text-xs font-mono">{callP.workspace_slug}</div></div>
            <div><span className="text-gray-500">From / To</span><div className="text-gray-200 text-xs font-mono">{callP.from_number} → {callP.to_number}</div></div>
          </>}
          {meetP && <>
            <div><span className="text-gray-500">Source type</span><div className="text-gray-200 font-mono text-xs">meeting</div></div>
            <div><span className="text-gray-500">Organizer</span><div className="text-gray-200 text-xs">{meetP.organizer_email ?? '—'}</div></div>
            <div><span className="text-gray-500">Attendee count</span><div className="text-gray-200">{meetP.attendee_count ?? '—'}</div></div>
            <div><span className="text-gray-500">Duration</span><div className="text-gray-200">{meetP.duration_seconds}s</div></div>
            <div><span className="text-gray-500">Provider</span><div className="text-gray-200">{meetP.provider}</div></div>
            <div><span className="text-gray-500">Recording status</span><div className={meetP.recording_status === 'recorded' ? 'text-green-400' : 'text-yellow-400'}>{meetP.recording_status}</div></div>
            <div><span className="text-gray-500">Recording detail</span><div className="text-gray-400 text-xs">{meetP.recording_detail ?? '—'}</div></div>
            <div><span className="text-gray-500">Has transcript</span><div className={meetP.has_transcript ? 'text-green-400' : 'text-gray-500'}>{String(meetP.has_transcript)}</div></div>
            <div><span className="text-gray-500">Summary status</span><div className="text-gray-200">{meetP.summary_status ?? '—'} (body withheld)</div></div>
          </>}
          <div className="col-span-full border-t border-gray-800/40 pt-2 mt-1">
            <span className="text-gray-500">Applied revision</span>
            <span className="ml-3 badge-gray">{record.applied_revision}</span>
            <span className="ml-3 text-gray-500">First imported:</span>
            <span className="ml-1 text-gray-400 text-xs">{formatTime(record.first_imported_at)}</span>
            <span className="ml-3 text-gray-500">Last updated:</span>
            <span className="ml-1 text-gray-400 text-xs">{formatTime(record.last_updated_at)}</span>
          </div>
        </div>
      </Section>

      {/* Transcript */}
      <Section title={record.source_type === 'call' ? 'Call Transcript' : 'Meeting Transcript'} icon={FileText}>
        {!record.has_usable_transcript ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No usable transcript available</p>
            {record.transcript_unavailable_reason && (
              <p className="text-sm mt-1">{record.transcript_unavailable_reason}</p>
            )}
          </div>
        ) : callP?.transcript ? (
          <div className="prose prose-invert max-w-none">
            <div className="bg-gray-950/50 rounded-lg p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-mono text-xs border border-gray-800/40">
              {callP.transcript}
            </div>
          </div>
        ) : transcriptP && transcriptP.turns.length > 0 ? (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 mb-2">{transcriptP.turns.length} turns · evidence citation: source_id + turn number</div>
            {transcriptP.turns.map((turn, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-16 shrink-0 text-right">
                  <span className="text-xs text-gray-600 font-mono">{turn.timecode}</span>
                </div>
                <div className="flex-1">
                  <span className={`text-xs font-semibold ${
                    turn.speaker.startsWith('Team') ? 'text-brand-400' :
                    turn.speaker.startsWith('Customer') ? 'text-green-400' :
                    turn.speaker.startsWith('Partner') ? 'text-purple-400' :
                    turn.speaker.startsWith('Supplier') ? 'text-yellow-400' : 'text-gray-400'
                  }`}>
                    [{i + 1}] {turn.speaker}
                  </span>
                  <p className="text-sm text-gray-300 mt-0.5 leading-relaxed">{turn.text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No turns available.</p>
        )}
      </Section>

      {/* Routing Decision */}
      <Section title="Routing Decision & Evidence" icon={Shield}>
        <div className="space-y-4">
          {/* Current route */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-400">Current route:</span>
            <span className={`badge text-sm py-1 px-3 ${ROUTE_BADGE_CLASS[record.route.primary_category]}`}>
              {ROUTE_LABELS[record.route.primary_category]}
            </span>
            {record.route.is_manual_override && (
              <>
                <span className="badge-orange"><Shield className="w-3 h-3" />manual override</span>
                {record.route.auto_suggested_category && (
                  <span className="text-xs text-gray-500">
                    (auto suggested: {ROUTE_LABELS[record.route.auto_suggested_category]})
                  </span>
                )}
              </>
            )}
            <span className={`badge ${
              record.route.analysis_freshness === 'current' ? 'badge-green' :
              record.route.analysis_freshness === 'stale' ? 'badge-red' : 'badge-yellow'
            }`}>
              {record.route.analysis_freshness}
            </span>
            <span className={`badge ${
              record.route.confidence === 'high' ? 'badge-green' :
              record.route.confidence === 'medium' ? 'badge-yellow' : 'badge-red'
            }`}>
              {record.route.confidence} confidence
            </span>
          </div>

          {/* Reason */}
          <div>
            <div className="section-header mb-1">Routing Reason</div>
            <p className="text-sm text-gray-300 leading-relaxed">{record.route.reason}</p>
          </div>

          {/* Manual note */}
          {record.route.is_manual_override && record.route.manual_note && (
            <div>
              <div className="section-header mb-1">Override Note</div>
              <div className="evidence-block">{record.route.manual_note}</div>
            </div>
          )}

          {/* Evidence */}
          {record.route.evidence_excerpts.length > 0 && (
            <div>
              <div className="section-header mb-2">Evidence Excerpts</div>
              <div className="space-y-2">
                {record.route.evidence_excerpts.map((ex, i) => (
                  <div key={i} className="evidence-block">
                    <div className="text-xs text-gray-500 mb-1 not-italic">
                      {ex.record_ref} · {ex.source_id}
                      {ex.turn_number && ` · turn ${ex.turn_number}`}
                    </div>
                    "{ex.quote}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Priority */}
          {record.priority_reason && (
            <div>
              <div className="section-header mb-1">Priority Reason</div>
              <p className="text-sm text-gray-400">{record.priority_reason}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            {record.review_status !== 'reviewed' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder="Optional review note…"
                  className="input-field text-xs py-1.5 w-48"
                  id="review-note"
                />
                <button
                  onClick={() => onMarkReviewed(record.source_id, record.source_type, reviewNote || undefined)}
                  className="btn-secondary text-xs py-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Reviewed
                </button>
              </div>
            )}
            <button
              onClick={() => setOverrideOpen(!overrideOpen)}
              className="btn-secondary text-xs py-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Change Route
            </button>
            {record.route.is_manual_override && (
              <button
                onClick={() => onResetOverride(record.source_id, record.source_type)}
                className="btn-secondary text-xs py-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to Auto
              </button>
            )}
          </div>

          {/* Override panel */}
          {overrideOpen && (
            <div className="glass-card-dark p-4 border border-brand-500/20 space-y-3">
              <div className="font-medium text-gray-200 text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-brand-400" />
                Override Route
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ALL_ROUTES.map(cat => (
                  <label
                    key={cat}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors text-xs
                      ${selectedRoute === cat
                        ? 'border-brand-500/60 bg-brand-500/10 text-brand-300'
                        : 'border-gray-700/40 text-gray-400 hover:border-gray-600'}`}
                  >
                    <input
                      type="radio"
                      name="route-override"
                      value={cat}
                      checked={selectedRoute === cat}
                      onChange={() => setSelectedRoute(cat)}
                      className="accent-brand-500"
                    />
                    {ROUTE_LABELS[cat]}
                  </label>
                ))}
              </div>
              <textarea
                value={overrideNote}
                onChange={e => setOverrideNote(e.target.value)}
                placeholder="Required: explain why you are changing this route…"
                className="input-field w-full text-xs h-20 resize-none"
                id="override-note"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveOverride}
                  disabled={!overrideNote.trim()}
                  className="btn-primary text-xs py-1.5 disabled:opacity-40"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Override
                </button>
                <button onClick={() => { setOverrideOpen(false); setOverrideNote(''); }} className="btn-secondary text-xs py-1.5">
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Review History */}
      <Section title="Review History" icon={History} defaultOpen={false}>
        <div className="space-y-2">
          {record.review_history.map((h, i) => (
            <div key={i} className="flex gap-3 text-xs border-b border-gray-800/30 pb-2">
              <div className="w-36 shrink-0 text-gray-600 font-mono">{h.at.slice(0, 16).replace('T', ' ')}</div>
              <div className="flex-1">
                <div className="text-gray-300 font-medium">{h.action}</div>
                <div className="text-gray-500">{h.actor}</div>
                {h.note && <div className="text-gray-400 mt-0.5">{h.note}</div>}
                {h.previous_route && h.new_route && (
                  <div className="text-gray-500 mt-0.5">
                    {h.previous_route} → {h.new_route}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
