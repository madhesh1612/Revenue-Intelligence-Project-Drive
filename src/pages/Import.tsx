import { useState, useRef } from 'react';
import {
  Upload, FileText, CheckCircle2, AlertCircle, ArrowRight,
  XCircle, RotateCcw, Info,
} from 'lucide-react';
import type { AppState, ImportBatch } from '../types';
import type { ImportResult } from '../importEngine';

interface Props {
  state: AppState;
  onImport: (batch: ImportBatch, sourceFile: string) => void;
  lastResult: ImportResult | null;
}

export function ImportPage({ state, onImport, lastResult }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Validate envelope
      if (!json.batch_id || !json.revision || !json.exported_at || !Array.isArray(json.records)) {
        throw new Error('Invalid envelope: missing batch_id, revision, exported_at, or records array.');
      }

      const batch: ImportBatch = {
        batch_id: json.batch_id,
        revision: json.revision,
        exported_at: json.exported_at,
        records: json.records,
      };

      // Check for duplicate batch
      const alreadyImported = state.import_batches.some(b => b.batch_id === batch.batch_id && b.revision === batch.revision);
      if (alreadyImported) {
        // Idempotent — re-import will skip everything, but user should know
        const proceed = window.confirm(
          `Batch ${batch.batch_id} (revision ${batch.revision}) has already been imported.\n\nRe-importing will skip all same-or-older-revision records. Continue?`
        );
        if (!proceed) {
          setImporting(false);
          return;
        }
      }

      onImport(batch, file.name);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error parsing file');
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const hasInitial = state.import_batches.some(b => b.revision === 1);
  const hasUpdate = state.import_batches.some(b => b.revision === 2);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Import Data</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Load the supplied JSON delivery files. Import order: <code className="text-brand-300">01_initial.json</code> first,
          then <code className="text-brand-300">02_update.json</code>.
        </p>
      </div>

      {/* Import steps */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-brand-400" />
          Replay Steps (DATA_CONTRACT.md)
        </h2>
        <div className="space-y-3">
          <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors
            ${hasInitial ? 'border-green-700/40 bg-green-900/10' : 'border-gray-700/40 bg-gray-900/30'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
              ${hasInitial ? 'bg-green-900/60 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
              1
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-200">Import 01_initial.json</div>
              <div className="text-xs text-gray-500">44 records · revision 1 · 30 calls + 14 meetings</div>
            </div>
            {hasInitial ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <ArrowRight className="w-5 h-5 text-brand-400" />
            )}
          </div>
          <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors
            ${hasUpdate ? 'border-green-700/40 bg-green-900/10' : 'border-gray-700/40 bg-gray-900/30'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
              ${hasUpdate ? 'bg-green-900/60 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
              2
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-200">Import 02_update.json</div>
              <div className="text-xs text-gray-500">1 record · revision 2 · M07 transcript now available</div>
            </div>
            {hasUpdate ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : hasInitial ? (
              <ArrowRight className="w-5 h-5 text-brand-400" />
            ) : (
              <span className="text-xs text-gray-600">step 1 first</span>
            )}
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`glass-card p-12 border-2 border-dashed text-center transition-all cursor-pointer
          ${dragOver ? 'border-brand-400 bg-brand-500/5' : 'border-gray-700 hover:border-gray-600'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
          id="file-input"
        />
        <Upload className={`w-12 h-12 mx-auto mb-4 ${dragOver ? 'text-brand-400' : 'text-gray-600'}`} />
        <p className="text-gray-300 font-medium">
          {importing ? 'Processing…' : 'Drop a JSON file here, or click to browse'}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Accepted: delivery envelope JSON files (01_initial.json, 02_update.json)
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card p-4 border border-red-700/40 bg-red-900/10 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-red-300 text-sm">Import failed</div>
            <div className="text-xs text-red-400 mt-1">{error}</div>
          </div>
        </div>
      )}

      {/* Last result */}
      {lastResult && (
        <div className="glass-card p-5 border border-green-700/30 bg-green-900/5">
          <h2 className="font-semibold text-green-300 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Last Import Result
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <div className="text-gray-500 text-xs">Created</div>
              <div className="text-green-400 font-bold text-lg">{lastResult.created}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Updated</div>
              <div className="text-blue-400 font-bold text-lg">{lastResult.updated}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Skipped</div>
              <div className="text-gray-400 font-bold text-lg">{lastResult.skipped}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Invalid</div>
              <div className={`font-bold text-lg ${lastResult.invalid > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {lastResult.invalid}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Total in file</div>
              <div className="text-gray-300 font-bold text-lg">{lastResult.batch_record.total_records}</div>
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-3">
            Batch: {lastResult.batch_record.batch_id} · Rev {lastResult.batch_record.revision} · Source: {lastResult.batch_record.source_file}
          </div>
          {lastResult.errors.length > 0 && (
            <div className="mt-3 space-y-1">
              {lastResult.errors.map((e, i) => (
                <div key={i} className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {e}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import history */}
      {state.import_batches.length > 0 && (
        <div className="glass-card p-5">
          <h2 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-400" />
            Import History
          </h2>
          <div className="space-y-2">
            {state.import_batches.map((b, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-900/40 border border-gray-800/30 text-sm">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <div>
                    <div className="text-gray-300 font-mono text-xs">{b.source_file}</div>
                    <div className="text-xs text-gray-500">{b.batch_id} · revision {b.revision}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="text-green-400">+{b.created}</span>
                  <span className="text-blue-400">↑{b.updated}</span>
                  <span className="text-gray-500">={b.skipped}</span>
                  {b.invalid > 0 && <span className="text-red-400">✗{b.invalid}</span>}
                  <span>{new Date(b.imported_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data contract note */}
      <div className="glass-card p-5 border-l-4 border-brand-500">
        <h2 className="font-semibold text-gray-200 mb-2 flex items-center gap-2">
          <Info className="w-4 h-4 text-brand-400" />
          Import Rules (DATA_CONTRACT.md)
        </h2>
        <ul className="text-sm text-gray-400 space-y-1.5 leading-relaxed">
          <li>• Identity = <code className="text-brand-300">(source_type, source_id)</code>. Not record_ref, not names, not array position.</li>
          <li>• A newer <code className="text-brand-300">revision</code> replaces the entire source payload including null values.</li>
          <li>• Same-or-older revision is ignored (idempotent — safe to re-import).</li>
          <li>• Manual routing overrides survive source updates but analysis freshness is flagged stale when transcript text changes.</li>
          <li>• All 44 records have the same activity date: 21 August 2026 (Asia/Kolkata). Delivery files are dated 22 August.</li>
          <li>• Two source files ≠ two complete snapshots. <code className="text-brand-300">02_update.json</code> contains only the M07 revision.</li>
        </ul>
      </div>
    </div>
  );
}
