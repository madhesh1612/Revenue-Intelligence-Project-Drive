import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Phone, Video, FileText, AlertCircle, CheckCircle,
  TrendingUp, Users, Clock, Zap, Eye, ArrowRight, Route,
} from 'lucide-react';
import type { AppState, ProcessedRecord, RouteCategory } from '../types';
import { computeMetrics } from '../metrics';

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

interface Props {
  state: AppState;
  onNavigate: (page: 'dashboard' | 'inbox' | 'routing' | 'import' | 'export' | 'detail') => void;
  onSelectRecord: (r: ProcessedRecord) => void;
}

function MetricCard({
  label, value, sub, icon: Icon, color = 'brand', tooltip
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  tooltip?: string;
}) {
  const colorClass: Record<string, string> = {
    brand: 'text-brand-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    gray: 'text-gray-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
  };
  return (
    <div className="metric-card group" title={tooltip}>
      <div className="flex items-center justify-between">
        <span className="section-header">{label}</span>
        <Icon className={`w-4 h-4 ${colorClass[color] ?? colorClass.brand}`} />
      </div>
      <div className={`text-3xl font-bold ${colorClass[color] ?? colorClass.brand}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card-dark p-3 shadow-xl text-sm">
      <div className="font-medium text-gray-200 mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }} className="flex items-center gap-2">
          <span>{p.name}:</span>
          <span className="font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage({ state, onNavigate, onSelectRecord }: Props) {
  const metrics = useMemo(() => computeMetrics(state.records), [state.records]);
  const hasData = state.records.length > 0;

  const routePieData = useMemo(() =>
    Object.entries(metrics.routing_distribution)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: ROUTE_LABELS[key as RouteCategory] ?? key,
        value,
        color: ROUTE_COLORS[key as RouteCategory] ?? '#6b7280',
      })),
    [metrics.routing_distribution]
  );

  const repBarData = useMemo(() =>
    metrics.rep_activity.slice(0, 8).map(r => ({
      name: r.rep_name.length > 10 ? r.rep_name.slice(0, 10) + '…' : r.rep_name,
      Calls: r.call_count,
      Meetings: r.meeting_organizer_count,
    })),
    [metrics.rep_activity]
  );

  const highPriorityItems = useMemo(() =>
    state.records
      .filter(r => r.priority === 'high')
      .sort((a, b) => a.activity_time_utc < b.activity_time_utc ? 1 : -1)
      .slice(0, 5),
    [state.records]
  );

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center p-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-600/20 border border-brand-500/20 flex items-center justify-center">
          <Zap className="w-10 h-10 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Revenue Intelligence Inbox</h1>
          <p className="text-gray-400 max-w-md">
            Import the supplied data files to begin. Start with <code className="text-brand-300">01_initial.json</code>, then apply <code className="text-brand-300">02_update.json</code>.
          </p>
        </div>
        <button onClick={() => onNavigate('import')} className="btn-primary text-base px-6 py-3">
          <FileText className="w-5 h-5" />
          Import Data Files
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-xs text-gray-600">Selected records: 44 (30 calls + 14 meetings) — 21 August 2026 Asia/Kolkata</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Manager Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Selected records: 21 August 2026 (Asia/Kolkata) · {state.records.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {metrics.high_priority_count > 0 && (
            <span className="badge-red">
              <AlertCircle className="w-3 h-3" />
              {metrics.high_priority_count} high priority
            </span>
          )}
          <button onClick={() => onNavigate('import')} className="btn-secondary text-xs py-1.5">
            <FileText className="w-3.5 h-3.5" />
            Import
          </button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
        <MetricCard
          label="Total Records"
          value={metrics.total_records}
          sub="Selected sample"
          icon={FileText}
          tooltip="Distinct (source_type, source_id) pairs after applying revisions"
        />
        <MetricCard
          label="Calls"
          value={metrics.total_calls}
          sub="Selected records"
          icon={Phone}
          color="brand"
        />
        <MetricCard
          label="Meetings"
          value={metrics.total_meetings}
          sub="Selected records"
          icon={Video}
          color="purple"
        />
        <MetricCard
          label="With Transcript"
          value={metrics.records_with_usable_transcript}
          sub={`${metrics.transcript_coverage_pct}% of total`}
          icon={FileText}
          color="green"
          tooltip="Records with usable text: non-blank call transcript or ≥1 meeting turn"
        />
        <MetricCard
          label="Awaiting Review"
          value={metrics.awaiting_review}
          sub="Not yet reviewed"
          icon={Clock}
          color="yellow"
        />
        <MetricCard
          label="High Priority"
          value={metrics.high_priority_count}
          sub="Needs attention"
          icon={AlertCircle}
          color="red"
        />
      </div>

      {/* Second row metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Connected Calls"
          value={metrics.connected_calls}
          sub={`${metrics.connected_call_rate_pct}% of calls with known status (source-reported)`}
          icon={Phone}
          color="green"
          tooltip={`Source-reported: calls with is_connected=true / calls with non-null is_connected. Unknown: ${metrics.connected_call_unknown_count}`}
        />
        <MetricCard
          label="Conversations"
          value={metrics.conversations}
          sub="is_conversation=true (source-reported)"
          icon={TrendingUp}
          color="brand"
          tooltip="Source-reported is_conversation flag. Not independently verified from transcript."
        />
        <MetricCard
          label="Call Coverage"
          value={`${metrics.call_transcript_coverage_pct}%`}
          sub={`${metrics.records_with_usable_transcript} calls w/ transcript`}
          icon={Phone}
          color="brand"
        />
        <MetricCard
          label="Meeting Coverage"
          value={`${metrics.meeting_transcript_coverage_pct}%`}
          sub="Meetings with usable turns"
          icon={Video}
          color="purple"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Routing distribution pie */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Route className="w-4 h-4 text-brand-400" />
            Routing Distribution
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={routePieData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${value}`}
                labelLine={false}
              >
                {routePieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                formatter={(value) => <span className="text-xs text-gray-300">{value}</span>}
              />
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Rep activity bar */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-400" />
            Activity by Rep / Organizer
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Calls grouped by rep_email; meetings by organizer_email. Organizer ≠ salesperson.
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={repBarData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis type="number" stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 11 }} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Calls" fill="#6366f1" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Meetings" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              <Legend formatter={(v) => <span className="text-xs text-gray-300">{v}</span>} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* High priority items */}
      {highPriorityItems.length > 0 && (
        <div className="glass-card p-5">
          <h2 className="font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            High-Priority Items
            <span className="badge-red ml-2">{highPriorityItems.length}</span>
          </h2>
          <div className="space-y-2">
            {highPriorityItems.map(r => (
              <div
                key={r.source_id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-gray-700/30 hover:border-gray-600/50 cursor-pointer transition-all"
                onClick={() => onSelectRecord(r)}
              >
                <div className="flex items-center gap-3">
                  <span className={`badge ${r.source_type === 'call' ? 'badge-blue' : 'badge-purple'}`}>
                    {r.record_ref}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-gray-200">{r.priority_reason}</div>
                    <div className="text-xs text-gray-500">{ROUTE_LABELS[r.route.primary_category]} · {r.activity_time_utc}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-red">high</span>
                  <Eye className="w-4 h-4 text-gray-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import history */}
      {state.import_batches.length > 0 && (
        <div className="glass-card p-5">
          <h2 className="font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            Import History
          </h2>
          <div className="space-y-2">
            {state.import_batches.map((b, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 rounded bg-gray-900/40">
                <span className="text-gray-300 font-mono text-xs">{b.batch_id}</span>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>rev {b.revision}</span>
                  <span className="text-green-400">+{b.created}</span>
                  <span className="text-blue-400">↑{b.updated}</span>
                  <span className="text-gray-500">={b.skipped}</span>
                  <span className="text-gray-500">{new Date(b.imported_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">+created ↑updated =skipped</p>
        </div>
      )}
    </div>
  );
}

