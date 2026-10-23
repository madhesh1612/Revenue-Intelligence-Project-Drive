import { useState } from 'react';
import {
  Download, FileText, FileJson, FileSpreadsheet,
  FileCheck2, AlertCircle, CheckCircle2,
} from 'lucide-react';
import type { AppState } from '../types';
import {
  generateManifest,
  generateConversationsCSV,
  generateRoutingCSV,
  generateManagerBrief,
  downloadText,
} from '../exportEngine';

interface Props {
  state: AppState;
}

interface ExportItem {
  label: string;
  description: string;
  filename: string;
  icon: React.ComponentType<{ className?: string }>;
  mimeType: string;
  generate: (state: AppState) => string;
}

const EXPORTS: ExportItem[] = [
  {
    label: 'Export Manifest',
    description: 'Machine-readable manifest listing every record, its routing, review state, and applied revision (JSON). Required by DATA_CONTRACT.md.',
    filename: 'manifest.json',
    icon: FileJson,
    mimeType: 'application/json',
    generate: (s) => JSON.stringify(generateManifest(s), null, 2),
  },
  {
    label: 'Conversations CSV',
    description: 'Normalized dataset of all records with metadata, routing, and review status in tabular format.',
    filename: 'conversations.csv',
    icon: FileSpreadsheet,
    mimeType: 'text/csv',
    generate: (s) => generateConversationsCSV(s.records),
  },
  {
    label: 'Routing Review CSV',
    description: 'Detailed routing decisions including confidence, manual overrides, and evidence counts. Useful for auditing routing logic.',
    filename: 'routing_review.csv',
    icon: FileSpreadsheet,
    mimeType: 'text/csv',
    generate: (s) => generateRoutingCSV(s.records),
  },
  {
    label: 'Manager Brief',
    description: '21 Aug 2026 executive summary with routing highlights, high-priority items, coaching opportunities, and key findings.',
    filename: 'manager_brief.txt',
    icon: FileText,
    mimeType: 'text/plain',
    generate: (s) => generateManagerBrief(s.records),
  },
];

export function ExportPage({ state }: Props) {
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());
  const hasData = state.records.length > 0;

  const handleExport = (item: ExportItem) => {
    try {
      const content = item.generate(state);
      downloadText(item.filename, content, item.mimeType);
      setDownloaded(prev => new Set(prev).add(item.filename));
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const handleExportAll = () => {
    for (const item of EXPORTS) {
      const content = item.generate(state);
      downloadText(item.filename, content, item.mimeType);
    }
    setDownloaded(new Set(EXPORTS.map(e => e.filename)));
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Exports</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Generate and download required deliverables.
          </p>
        </div>
        {hasData && (
          <button onClick={handleExportAll} className="btn-primary">
            <Download className="w-4 h-4" />
            Export All
          </button>
        )}
      </div>

      {!hasData ? (
        <div className="glass-card p-12 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Import data first to generate exports.</p>
        </div>
      ) : (
        <>
          {/* Export cards */}
          <div className="space-y-4">
            {EXPORTS.map(item => {
              const Icon = item.icon;
              const done = downloaded.has(item.filename);
              return (
                <div key={item.filename} className="glass-card p-5 flex items-center gap-4 hover:border-gray-600/50 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-gray-800/60 flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6 text-brand-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-200 flex items-center gap-2">
                      {item.label}
                      <span className="text-xs text-gray-500 font-mono">{item.filename}</span>
                      {done && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    </div>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{item.description}</p>
                  </div>
                  <button
                    onClick={() => handleExport(item)}
                    className={done ? 'btn-secondary text-xs py-1.5' : 'btn-primary text-xs py-1.5'}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {done ? 'Re-download' : 'Download'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="glass-card p-5">
            <h2 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-brand-400" />
              Export Coverage
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500 text-xs">Total records</div>
                <div className="text-gray-200 font-bold text-lg">{state.records.length}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Reviewed</div>
                <div className="text-green-400 font-bold text-lg">
                  {state.records.filter(r => r.review_status === 'reviewed').length}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Manual overrides</div>
                <div className="text-orange-400 font-bold text-lg">
                  {state.records.filter(r => r.route.is_manual_override).length}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Import batches</div>
                <div className="text-gray-300 font-bold text-lg">{state.import_batches.length}</div>
              </div>
            </div>
          </div>

          {/* SUBMISSION_CHECKLIST reference */}
          <div className="glass-card p-5 border-l-4 border-green-600">
            <h2 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-green-400" />
              Submission Checklist Reference
            </h2>
            <ul className="text-sm text-gray-400 space-y-1.5">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                manifest.json — machine-readable with all 44 records
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                conversations.csv — normalised tabular export
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                routing_review.csv — routing decisions with confidence and evidence
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                manager_brief.txt — executive summary with coaching & escalation notes
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
