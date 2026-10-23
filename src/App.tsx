import { useState, useCallback, useEffect } from 'react';
import {
  LayoutDashboard,
  Inbox,
  Route,
  Settings,
  FileText,
  Upload,
  ChevronRight,
  Activity,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import type { AppState, ProcessedRecord } from './types';
import {
  loadState,
  saveState,
  importBatch,
  applyManualOverride,
  markReviewed,
  resetManualOverride,
} from './importEngine';
import type { ImportResult } from './importEngine';
import type { ImportBatch } from './types';
import { DashboardPage } from './pages/Dashboard';
import { InboxPage } from './pages/Inbox';
import { ConversationDetail } from './pages/ConversationDetail';
import { RoutingPage } from './pages/Routing';
import { ImportPage } from './pages/Import';
import { ExportPage } from './pages/Export';

// ─── Navigation pages ─────────────────────────────────────────────────────────
type Page = 'dashboard' | 'inbox' | 'routing' | 'import' | 'export' | 'detail';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedRecord, setSelectedRecord] = useState<ProcessedRecord | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lastImportResult, setLastImportResult] = useState<ImportResult | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);

  // Persist on every state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  const showNotification = useCallback((type: 'success' | 'error' | 'info', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const handleImport = useCallback((batch: ImportBatch, sourceFile: string) => {
    const result = importBatch(state, batch, sourceFile);
    setState(result.state);
    setLastImportResult(result);
    showNotification('success', `Import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
  }, [state, showNotification]);

  const handleManualOverride = useCallback((
    sourceId: string,
    sourceType: string,
    category: import('./types').RouteCategory,
    note: string
  ) => {
    const newState = applyManualOverride(state, sourceId, sourceType, category, note);
    setState(newState);
    // Update selected record if it's the one we're editing
    if (selectedRecord && selectedRecord.source_id === sourceId) {
      const updated = newState.records.find(r => r.source_id === sourceId);
      if (updated) setSelectedRecord(updated);
    }
    showNotification('success', 'Route override saved');
  }, [state, selectedRecord, showNotification]);

  const handleMarkReviewed = useCallback((sourceId: string, sourceType: string, note?: string) => {
    const newState = markReviewed(state, sourceId, sourceType, note);
    setState(newState);
    if (selectedRecord && selectedRecord.source_id === sourceId) {
      const updated = newState.records.find(r => r.source_id === sourceId);
      if (updated) setSelectedRecord(updated);
    }
    showNotification('success', 'Marked as reviewed');
  }, [state, selectedRecord, showNotification]);

  const handleResetOverride = useCallback((sourceId: string, sourceType: string) => {
    const newState = resetManualOverride(state, sourceId, sourceType);
    setState(newState);
    if (selectedRecord && selectedRecord.source_id === sourceId) {
      const updated = newState.records.find(r => r.source_id === sourceId);
      if (updated) setSelectedRecord(updated);
    }
    showNotification('info', 'Override reset — automated route restored');
  }, [state, selectedRecord, showNotification]);

  const handleSelectRecord = useCallback((record: ProcessedRecord) => {
    setSelectedRecord(record);
    setCurrentPage('detail');
  }, []);

  const handleClearState = useCallback(() => {
    if (window.confirm('Clear all imported data and start fresh? This cannot be undone.')) {
      import('./importEngine').then(({ clearState }) => {
        const fresh = clearState();
        setState(fresh);
        setLastImportResult(null);
        setSelectedRecord(null);
        setCurrentPage('import');
        showNotification('info', 'Data cleared — ready for fresh import');
      });
    }
  }, [showNotification]);

  const pendingCount = state.records.filter(r => r.review_status === 'pending').length;
  const highPriorityCount = state.records.filter(r => r.priority === 'high').length;
  const hasData = state.records.length > 0;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inbox', label: 'Inbox', icon: Inbox, badge: pendingCount > 0 ? pendingCount : undefined },
    { id: 'routing', label: 'Routing & Analysis', icon: Route },
    { id: 'import', label: 'Import', icon: Upload },
    { id: 'export', label: 'Exports', icon: FileText },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} transition-all duration-200 flex flex-col border-r border-gray-800/60 bg-gray-950/90 backdrop-blur-sm flex-shrink-0`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800/60">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Activity className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-white leading-tight">Revenue Intelligence</div>
              <div className="text-xs text-gray-500">SpendNest Inbox</div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id || (currentPage === 'detail' && item.id === 'inbox');
            return (
              <button
                key={item.id}
                onClick={() => { setCurrentPage(item.id); if (item.id !== 'inbox' && item.id !== 'detail') setSelectedRecord(null); }}
                className={isActive ? 'nav-item-active w-full text-left' : 'nav-item-inactive w-full text-left'}
              >
                <div className="relative">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-brand-300' : 'text-gray-500'}`} />
                  {item.badge && (
                    <span className="absolute -top-1.5 -right-1.5 bg-brand-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                {sidebarOpen && <span className="truncate">{item.label}</span>}
                {sidebarOpen && item.badge && (
                  <span className="ml-auto badge-blue text-xs">{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Status */}
        {sidebarOpen && (
          <div className="p-3 border-t border-gray-800/60 space-y-2">
            <div className="text-xs text-gray-600">
              {hasData ? (
                <span className="text-green-500">● {state.records.length} records loaded</span>
              ) : (
                <span className="text-yellow-500">● No data — import to begin</span>
              )}
            </div>
            {highPriorityCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-orange-400">
                <AlertCircle className="w-3 h-3" />
                {highPriorityCount} high priority
              </div>
            )}
            <button
              onClick={handleClearState}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors w-full text-left"
            >
              Reset data
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-xl text-sm font-medium flex items-center gap-2 animate-pulse-slow
            ${notification.type === 'success' ? 'bg-green-900/90 text-green-200 border border-green-700' :
              notification.type === 'error' ? 'bg-red-900/90 text-red-200 border border-red-700' :
              'bg-blue-900/90 text-blue-200 border border-blue-700'}`}>
            <Sparkles className="w-4 h-4" />
            {notification.msg}
          </div>
        )}

        {/* Pages */}
        {currentPage === 'dashboard' && (
          <DashboardPage state={state} onNavigate={setCurrentPage} onSelectRecord={handleSelectRecord} />
        )}
        {(currentPage === 'inbox' || currentPage === 'detail') && !selectedRecord && (
          <InboxPage
            records={state.records}
            onSelectRecord={handleSelectRecord}
          />
        )}
        {currentPage === 'detail' && selectedRecord && (
          <ConversationDetail
            record={selectedRecord}
            allRecords={state.records}
            onBack={() => setCurrentPage('inbox')}
            onManualOverride={handleManualOverride}
            onMarkReviewed={handleMarkReviewed}
            onResetOverride={handleResetOverride}
          />
        )}
        {currentPage === 'inbox' && !selectedRecord && (
          <InboxPage records={state.records} onSelectRecord={handleSelectRecord} />
        )}
        {currentPage === 'routing' && (
          <RoutingPage records={state.records} onSelectRecord={handleSelectRecord} />
        )}
        {currentPage === 'import' && (
          <ImportPage
            state={state}
            onImport={handleImport}
            lastResult={lastImportResult}
          />
        )}
        {currentPage === 'export' && (
          <ExportPage state={state} />
        )}
      </main>
    </div>
  );
}
