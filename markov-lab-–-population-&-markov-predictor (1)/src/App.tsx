import { Menu, Sun } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { api } from './lib/api';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryHelpPage } from './pages/HistoryHelpPage';
import { MarkovSimulatorPage } from './pages/MarkovSimulatorPage';
import { MathematicalAnalysisPage } from './pages/MathematicalAnalysisPage';
import { MatrixBuilderPage } from './pages/MatrixBuilderPage';
import { SimulationManagerPage } from './pages/SimulationManagerPage';
import type {
  DashboardData,
  HealthStatus,
  PageId,
  Simulation,
  SimulationRun,
  TransitionMatrix,
} from './types';

function AcademicBackdropWatermark() {
  return (
    <div
      className="pointer-events-none fixed bottom-2 right-4 z-0 hidden xl:flex flex-col items-end opacity-[0.14] select-none"
      aria-hidden="true"
    >
      <div className="font-serif-display italic text-xl font-semibold text-[#6E6352] mr-4 mb-1">
        P&#8319; &rarr; &Pi;
      </div>
      <svg width="210" height="105" viewBox="0 0 210 105" fill="none">
        <path d="M15 95H195M25 85H185M35 85V45M55 85V45M75 85V45M135 85V45M155 85V45M175 85V45M28 45H182L105 16L28 45Z" stroke="#6E6352" strokeWidth="1.5" />
        <rect x="92" y="54" width="26" height="31" stroke="#6E6352" strokeWidth="1.4" />
        <circle cx="105" cy="31" r="4.5" stroke="#6E6352" strokeWidth="1.4" />
      </svg>
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [matrices, setMatrices] = useState<TransitionMatrix[]>([]);
  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [loading, setLoading] = useState(true);

  const [contextSimId, setContextSimId] = useState<number | null>(null);
  const [contextMatrixId, setContextMatrixId] = useState<number | null>(null);
  const [loadedRun, setLoadedRun] = useState<SimulationRun | null>(null);

  const refreshAll = useCallback(async () => {
    try {
      const [h, dash, sims, mats, rns] = await Promise.all([
        api.getHealth(),
        api.getDashboard(),
        api.getSimulations(),
        api.getMatrices(),
        api.getRuns(),
      ]);
      setHealth(h);
      setDashboard(dash);
      setSimulations(sims);
      setMatrices(mats);
      setRuns(rns);
    } catch (err) {
      console.error('Failed to load Markov Lab data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleNavigate = (page: PageId) => {
    if (page !== 'markov-simulator') {
      setLoadedRun(null);
    }
    setActivePage(page);
  };

  const handleNavigateWithSim = (page: PageId, simId: number, matrixId?: number) => {
    setLoadedRun(null);
    setContextSimId(simId > 0 ? simId : null);
    setContextMatrixId(matrixId ?? null);
    setActivePage(page);
  };

  const handleOpenRun = (run: SimulationRun) => {
    setLoadedRun(run);
    setContextSimId(run.simulation_id);
    setContextMatrixId(run.matrix_id);
    setActivePage('markov-simulator');
  };

  const handleLoadExample = async () => {
    await api.seedExample();
    await refreshAll();
  };

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpenMobile((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F5F0E6] text-[#292724]">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        isOpenMobile={sidebarOpenMobile}
        onCloseMobile={() => setSidebarOpenMobile(false)}
        collapsed={sidebarCollapsed}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Utility Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[#E5DEC9] bg-[#F5F0E6]/95 px-5 sm:px-8 py-3.5 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleSidebar}
              aria-label="Toggle navigation sidebar"
              className="rounded-lg p-1.5 text-[#10233F] hover:bg-[#EAE2D3] transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="hidden sm:inline text-xs font-medium text-[#6B655B]">
              Markov Lab &middot; Population &amp; Markov Predictor
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span
              className="hidden sm:inline-flex items-center justify-center rounded-lg p-1.5 text-[#4A463F]"
              title="Warm Linen Academic Theme"
            >
              <Sun className="h-4.5 w-4.5" />
            </span>

            <div className="inline-flex items-center gap-2 rounded-full border border-[#DFD7C5] bg-[#FFFCF6] px-3.5 py-1.5 text-xs font-semibold text-[#10233F] shadow-2xs">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  health?.connected ? 'bg-[#2E7D32]' : 'bg-[#D97706]'
                }`}
              />
              <span>{health?.connected ? 'SQLite Connected' : 'Connecting SQLite...'}</span>
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="relative z-10 flex-1 px-5 sm:px-8 pt-6 max-w-[1360px] w-full mx-auto">
          {activePage === 'dashboard' && (
            <DashboardPage
              data={dashboard}
              loading={loading}
              onNavigate={handleNavigate}
              onOpenRun={handleOpenRun}
              onLoadExample={handleLoadExample}
            />
          )}

          {activePage === 'simulation-manager' && (
            <SimulationManagerPage
              simulations={simulations}
              onRefresh={refreshAll}
              onNavigateWithSim={handleNavigateWithSim}
            />
          )}

          {activePage === 'matrix-builder' && (
            <MatrixBuilderPage
              simulations={simulations}
              matrices={matrices}
              initialSimulationId={contextSimId}
              onRefresh={refreshAll}
              onNavigateWithSim={handleNavigateWithSim}
            />
          )}

          {activePage === 'markov-simulator' && (
            <MarkovSimulatorPage
              simulations={simulations}
              matrices={matrices}
              initialSimulationId={contextSimId}
              initialMatrixId={contextMatrixId}
              loadedRun={loadedRun}
              onClearLoadedRun={() => setLoadedRun(null)}
              onRefresh={refreshAll}
              onNavigate={handleNavigate}
            />
          )}

          {activePage === 'mathematical-analysis' && (
            <MathematicalAnalysisPage
              simulations={simulations}
              matrices={matrices}
              runs={runs}
              onNavigate={handleNavigate}
            />
          )}

          {activePage === 'history-help' && (
            <HistoryHelpPage
              simulations={simulations}
              runs={runs}
              onOpenRun={handleOpenRun}
              onRefresh={refreshAll}
            />
          )}
        </main>

        <AcademicBackdropWatermark />
      </div>
    </div>
  );
}
