import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Route, Shield, AlertCircle, Eye, FileText, CheckCircle2, Clock,
} from 'lucide-react';
import type { ProcessedRecord, RouteCategory } from '../types';

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

const ROUTE_COLORS: Record<RouteCategory, string> = {
  prospect_follow_up: '#6366f1',
  partner_opportunity: '#8b5cf6',
  customer_success: '#22c55e',
  internal_operations: '#94a3b8',
  vendor_supplier: '#f59e0b',
  no_connection: '#374151',
  no_transcript: '#4b5563',
  human_review_needed: '#ef4444',
};

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
  records: ProcessedRecord[];
  onSelectRecord: (r: ProcessedRecord) => void;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card-dark p-3 shadow-xl text-sm">
      <div className="font-medium text-gray-200">{payload[0].name}: {payload[0].value}</div>
    </div>
  );
}

export function RoutingPage({ records, onSelectRecord }: Props) {
  const routeGroups = useMemo(() => {
    const groups: Record<RouteCategory, ProcessedRecord[]> = {} as any;
    for (const cat of Object.keys(ROUTE_LABELS) as RouteCategory[]) {
      groups[cat] = [];
    }
    for (const r of records) {
      const cat = r.route.primary_category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    }
    return groups;
  }, [records]);

  const pieData = useMemo(() =>
    Object.entries(routeGroups)
      .filter(([, recs]) => recs.length > 0)
      .map(([key, recs]) => ({
        name: ROUTE_LABELS[key as RouteCategory],
        value: recs.length,
        color: ROUTE_COLORS[key as RouteCategory],
      })),
    [routeGroups]
  );

  const overrideRecords = useMemo(() =>
    records.filter(r => r.route.is_manual_override),
    [records]
  );

  const staleRecords = useMemo(() =>
    records.filter(r => r.route.analysis_freshness === 'stale'),
    [records]
  );

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
        <Route className="w-12 h-12 opacity-30" />
        <p>No records loaded. Import data to see routing analysis.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Routing & Analysis</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Transparent, rule-based routing of all {records.length} selected records. Categories documented below.
        </p>
      </div>

      {/* Routing policy explanation */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-400" />
          Routing Policy
        </h2>
        <p className="text-sm text-gray-400 mb-3 leading-relaxed">
          Each record is classified using a deterministic rule engine that reads the transcript text first, then uses
          source metadata as secondary signal. The <code className="text-brand-300">observed_outcome</code> field is a
          stored machine label from the upstream system — it is <strong>not</strong> used as the primary routing key because
          it sometimes disagrees with the transcript (e.g., C04 is labelled <code className="text-brand-300">voicemail</code> with{' '}
          <code className="text-brand-300">is_connected=false</code> but contains a two-speaker voicemail conversation).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {(Object.keys(ROUTE_LABELS) as RouteCategory[]).map(cat => (
            <div key={cat} className="flex items-center gap-2 p-2 rounded bg-gray-900/50 border border-gray-800/40">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ROUTE_COLORS[cat] }} />
              <div>
                <div className="font-medium text-gray-300">{ROUTE_LABELS[cat]}</div>
                <div className="text-gray-500">{routeGroups[cat]?.length ?? 0} records</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-gray-200 mb-3">Distribution</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                   label={({ name, value }) => `${value}`} labelLine={false}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Legend formatter={(v) => <span className="text-xs text-gray-300">{v}</span>} />
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Alerts */}
        <div className="space-y-4">
          {overrideRecords.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-orange-400" />
                Manual Overrides ({overrideRecords.length})
              </h2>
              <div className="space-y-2">
                {overrideRecords.map(r => (
                  <div key={r.source_id}
                       className="flex items-center justify-between p-2 rounded bg-gray-900/50 border border-gray-800/40 hover:border-gray-600/50 cursor-pointer text-xs"
                       onClick={() => onSelectRecord(r)}>
                    <div className="flex items-center gap-2">
                      <span className="badge-blue font-mono">{r.record_ref}</span>
                      <span className={ROUTE_BADGE_CLASS[r.route.primary_category]}>{ROUTE_LABELS[r.route.primary_category]}</span>
                      {r.route.auto_suggested_category && (
                        <span className="text-gray-500">was: {ROUTE_LABELS[r.route.auto_suggested_category]}</span>
                      )}
                    </div>
                    <Eye className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {staleRecords.length > 0 && (
            <div className="glass-card p-5">
              <h2 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                Stale Analysis ({staleRecords.length})
              </h2>
              <p className="text-xs text-gray-500 mb-2">Source text changed but analysis hasn't been refreshed.</p>
              <div className="space-y-2">
                {staleRecords.map(r => (
                  <div key={r.source_id}
                       className="flex items-center justify-between p-2 rounded bg-gray-900/50 border border-red-900/30 hover:border-red-800/50 cursor-pointer text-xs"
                       onClick={() => onSelectRecord(r)}>
                    <span className="badge-blue font-mono">{r.record_ref}</span>
                    <span className="badge-red">stale</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card p-5">
            <h2 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Review Progress
            </h2>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-gray-300">{records.filter(r => r.review_status === 'reviewed').length} reviewed</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-gray-300">{records.filter(r => r.review_status === 'pending').length} pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Records by route */}
      {(Object.keys(ROUTE_LABELS) as RouteCategory[])
        .filter(cat => routeGroups[cat]?.length > 0)
        .map(cat => (
          <div key={cat} className="glass-card p-5">
            <h2 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: ROUTE_COLORS[cat] }} />
              {ROUTE_LABELS[cat]}
              <span className="text-gray-500 font-normal text-sm ml-1">({routeGroups[cat].length})</span>
            </h2>
            <div className="space-y-1.5">
              {routeGroups[cat].map(r => (
                <div key={r.source_id}
                     className="flex items-center justify-between p-2.5 rounded-lg bg-gray-900/40 border border-gray-800/30 hover:border-gray-700/50 cursor-pointer transition-all text-sm"
                     onClick={() => onSelectRecord(r)}>
                  <div className="flex items-center gap-3">
                    <span className="badge-blue font-mono text-xs">{r.record_ref}</span>
                    <span className="text-gray-300 text-xs max-w-xs truncate">{r.route.reason.slice(0, 80)}…</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.has_usable_transcript
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      : <span className="w-3.5 h-3.5 rounded-full bg-gray-700" />}
                    <span className={`badge text-xs ${r.route.confidence === 'high' ? 'badge-green' : r.route.confidence === 'medium' ? 'badge-yellow' : 'badge-red'}`}>
                      {r.route.confidence}
                    </span>
                    {r.route.is_manual_override && <Shield className="w-3.5 h-3.5 text-orange-400" />}
                    <Eye className="w-3.5 h-3.5 text-gray-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

      {/* Rejected decision */}
      <div className="glass-card p-5 border-l-4 border-yellow-600">
        <h2 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-400" />
          Deliberately Rejected Decision
        </h2>
        <p className="text-sm text-gray-300 leading-relaxed">
          <strong>Alternative considered:</strong> Using the <code className="text-brand-300">observed_outcome</code> field
          as the primary routing key (e.g., "voicemail" → no_connection, "follow_up" → prospect_follow_up).
        </p>
        <p className="text-sm text-gray-400 mt-2 leading-relaxed">
          <strong>Why rejected:</strong> The <code className="text-brand-300">observed_outcome</code> is a stored machine
          classification from the upstream system, not independent ground truth. Transcript evidence reveals disagreements:
          C04 has <code className="text-brand-300">is_connected=false</code> and <code className="text-brand-300">observed_outcome="voicemail"</code> but
          its transcript contains a substantive two-speaker voicemail with a named prospect at Lanternpath Media and a clear
          follow-up ask. Similarly, C06 has <code className="text-brand-300">rep_name="Meera"</code> but the transcript shows
          the caller introducing themselves as "Ravi" — the metadata and text disagree on the speaker. Routing by transcript
          evidence first is more reliable for analysis, even if it requires more complex rules.
        </p>
        <p className="text-sm text-gray-400 mt-2 leading-relaxed">
          <strong>Trade-off accepted:</strong> Transcript-first routing means we cannot route the 26 background calls
          without usable text — they all go to <code className="text-brand-300">no_connection</code> without further analysis.
          This is a conservative choice: we do not invent analysis where evidence is absent.
        </p>
      </div>
    </div>
  );
}
