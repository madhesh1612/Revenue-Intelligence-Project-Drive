import { useState, useMemo } from 'react';
import {
  Search, Phone, Video, FileText, Filter, X, ChevronUp, ChevronDown, RotateCcw,
  Circle, CheckCircle2, AlertCircle, Clock
} from 'lucide-react';
import type { ProcessedRecord, RouteCategory } from '../types';
import type { CallPayload, MeetingPayload } from '../types';

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

function getRepOrOrg(r: ProcessedRecord): string {
  if (r.source_type === 'call') {
    const p = r.payload as CallPayload;
    return p.rep_name ?? p.rep_email ?? '—';
  }
  return (r.payload as MeetingPayload).organizer_email ?? '—';
}

function getDuration(r: ProcessedRecord): string {
  const secs = r.source_type === 'call'
    ? (r.payload as CallPayload).duration_seconds
    : (r.payload as MeetingPayload).duration_seconds;
  if (!secs) return '—';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function getTitle(r: ProcessedRecord): string {
  if (r.source_type === 'meeting') return (r.payload as MeetingPayload).title ?? '—';
  const p = r.payload as CallPayload;
  return p.observed_outcome ? `${p.direction} · ${p.observed_outcome}` : p.direction ?? '—';
}

type SortField = 'record_ref' | 'activity_time_utc' | 'duration' | 'route' | 'review_status' | 'priority';
type SortDir = 'asc' | 'desc';

const ALL_ROUTES: RouteCategory[] = [
  'prospect_follow_up', 'partner_opportunity', 'customer_success',
  'internal_operations', 'vendor_supplier', 'no_connection', 'no_transcript', 'human_review_needed',
];

interface Props {
  records: ProcessedRecord[];
  onSelectRecord: (r: ProcessedRecord) => void;
}

export function InboxPage({ records, onSelectRecord }: Props) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'call' | 'meeting'>('all');
  const [filterRoute, setFilterRoute] = useState<RouteCategory | 'all'>('all');
  const [filterTranscript, setFilterTranscript] = useState<'all' | 'yes' | 'no'>('all');
  const [filterReview, setFilterReview] = useState<'all' | 'pending' | 'reviewed'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortField, setSortField] = useState<SortField>('activity_time_utc');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    let list = records;
    if (filterType !== 'all') list = list.filter(r => r.source_type === filterType);
    if (filterRoute !== 'all') list = list.filter(r => r.route.primary_category === filterRoute);
    if (filterTranscript !== 'all') list = list.filter(r =>
      filterTranscript === 'yes' ? r.has_usable_transcript : !r.has_usable_transcript
    );
    if (filterReview !== 'all') list = list.filter(r => r.review_status === filterReview);
    if (filterPriority !== 'all') list = list.filter(r => r.priority === filterPriority);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.record_ref.toLowerCase().includes(q) ||
        r.source_id.toLowerCase().includes(q) ||
        getRepOrOrg(r).toLowerCase().includes(q) ||
        getTitle(r).toLowerCase().includes(q) ||
        r.route.primary_category.includes(q) ||
        (r.source_type === 'call' && ((r.payload as CallPayload).transcript ?? '').toLowerCase().includes(q))
      );
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'record_ref': cmp = a.record_ref.localeCompare(b.record_ref); break;
        case 'activity_time_utc': cmp = a.activity_time_utc < b.activity_time_utc ? -1 : 1; break;
        case 'duration': {
          const aD = a.source_type === 'call' ? (a.payload as CallPayload).duration_seconds : (a.payload as MeetingPayload).duration_seconds;
          const bD = b.source_type === 'call' ? (b.payload as CallPayload).duration_seconds : (b.payload as MeetingPayload).duration_seconds;
          cmp = (aD ?? 0) - (bD ?? 0);
          break;
        }
        case 'route': cmp = a.route.primary_category.localeCompare(b.route.primary_category); break;
        case 'review_status': cmp = a.review_status.localeCompare(b.review_status); break;
        case 'priority': {
          const pOrd = { high: 0, medium: 1, low: 2 };
          cmp = pOrd[a.priority] - pOrd[b.priority];
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [records, filterType, filterRoute, filterTranscript, filterReview, filterPriority, search, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const resetFilters = () => {
    setSearch(''); setFilterType('all'); setFilterRoute('all');
    setFilterTranscript('all'); setFilterReview('all'); setFilterPriority('all');
    setPage(0);
  };

  const hasFilters = filterType !== 'all' || filterRoute !== 'all' || filterTranscript !== 'all' ||
    filterReview !== 'all' || filterPriority !== 'all' || search.trim().length > 0;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 text-gray-600" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-brand-400" />
      : <ChevronDown className="w-3 h-3 text-brand-400" />;
  };

  return (
    <div className="p-6 space-y-4 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue Intelligence Inbox</h1>
          <p className="text-sm text-gray-400">
            {filtered.length} of {records.length} records · 21 Aug 2026 Asia/Kolkata
          </p>
        </div>
        {hasFilters && (
          <button onClick={resetFilters} className="btn-secondary text-xs py-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset filters
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            id="inbox-search"
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search records, reps, transcript…"
            className="input-field w-full pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300" />
            </button>
          )}
        </div>

        {/* Type */}
        <select
          id="filter-type"
          className="input-field text-xs py-1.5"
          value={filterType}
          onChange={e => { setFilterType(e.target.value as typeof filterType); setPage(0); }}
        >
          <option value="all">All types</option>
          <option value="call">Calls</option>
          <option value="meeting">Meetings</option>
        </select>

        {/* Route */}
        <select
          id="filter-route"
          className="input-field text-xs py-1.5"
          value={filterRoute}
          onChange={e => { setFilterRoute(e.target.value as typeof filterRoute); setPage(0); }}
        >
          <option value="all">All routes</option>
          {ALL_ROUTES.map(r => (
            <option key={r} value={r}>{ROUTE_LABELS[r]}</option>
          ))}
        </select>

        {/* Transcript */}
        <select
          id="filter-transcript"
          className="input-field text-xs py-1.5"
          value={filterTranscript}
          onChange={e => { setFilterTranscript(e.target.value as typeof filterTranscript); setPage(0); }}
        >
          <option value="all">All transcript statuses</option>
          <option value="yes">With transcript</option>
          <option value="no">No transcript</option>
        </select>

        {/* Review */}
        <select
          id="filter-review"
          className="input-field text-xs py-1.5"
          value={filterReview}
          onChange={e => { setFilterReview(e.target.value as typeof filterReview); setPage(0); }}
        >
          <option value="all">All review statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
        </select>

        {/* Priority */}
        <select
          id="filter-priority"
          className="input-field text-xs py-1.5"
          value={filterPriority}
          onChange={e => { setFilterPriority(e.target.value as typeof filterPriority); setPage(0); }}
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
          <Filter className="w-3.5 h-3.5" />
          {filtered.length} results
        </div>
      </div>

      {/* Table */}
      {records.length === 0 ? (
        <div className="glass-card p-12 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No records imported yet. Use the Import page to load data.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-gray-500">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No records match the current filters.</p>
          <button onClick={resetFilters} className="btn-secondary mt-4 mx-auto">
            <RotateCcw className="w-4 h-4" /> Reset filters
          </button>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/40">
                  {[
                    { label: 'Ref', field: 'record_ref' as SortField },
                    { label: 'Type', field: null },
                    { label: 'Time (UTC)', field: 'activity_time_utc' as SortField },
                    { label: 'Rep / Organizer', field: null },
                    { label: 'Title / Outcome', field: null },
                    { label: 'Duration', field: 'duration' as SortField },
                    { label: 'Transcript', field: null },
                    { label: 'Route', field: 'route' as SortField },
                    { label: 'Priority', field: 'priority' as SortField },
                    { label: 'Review', field: 'review_status' as SortField },
                    { label: 'Override', field: null },
                  ].map(({ label, field }) => (
                    <th
                      key={label}
                      className={`text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap
                        ${field ? 'cursor-pointer hover:text-gray-200 select-none' : ''}`}
                      onClick={() => field && handleSort(field)}
                    >
                      <div className="flex items-center gap-1">
                        {label}
                        {field && <SortIcon field={field} />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(r => (
                  <tr
                    key={`${r.source_type}:${r.source_id}`}
                    className="table-row-hover border-b border-gray-800/40"
                    onClick={() => onSelectRecord(r)}
                  >
                    <td className="px-4 py-3">
                      <span className={`badge ${r.source_type === 'call' ? 'badge-blue' : 'badge-purple'} font-mono`}>
                        {r.record_ref}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.source_type === 'call'
                        ? <Phone className="w-4 h-4 text-blue-400" />
                        : <Video className="w-4 h-4 text-purple-400" />}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">
                      {r.activity_time_utc.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300 max-w-28 truncate">
                      {getRepOrOrg(r)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-36 truncate">
                      {getTitle(r)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {getDuration(r)}
                    </td>
                    <td className="px-4 py-3">
                      {r.has_usable_transcript
                        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                        : <Circle className="w-4 h-4 text-gray-600" />}
                    </td>
                    <td className="px-4 py-3">
                      <span className={ROUTE_BADGE_CLASS[r.route.primary_category]}>
                        {ROUTE_LABELS[r.route.primary_category]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={
                        r.priority === 'high' ? 'badge-red' :
                        r.priority === 'medium' ? 'badge-yellow' : 'badge-gray'
                      }>
                        {r.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.review_status === 'reviewed'
                        ? <span className="badge-green"><CheckCircle2 className="w-3 h-3" />reviewed</span>
                        : <span className="badge-yellow"><Clock className="w-3 h-3" />pending</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.route.is_manual_override && (
                        <span className="badge-orange"><AlertCircle className="w-3 h-3" />manual</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 text-xs text-gray-400">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="btn-secondary py-1 px-2 text-xs disabled:opacity-40"
                >
                  Previous
                </button>
                <span>{page + 1} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="btn-secondary py-1 px-2 text-xs disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
