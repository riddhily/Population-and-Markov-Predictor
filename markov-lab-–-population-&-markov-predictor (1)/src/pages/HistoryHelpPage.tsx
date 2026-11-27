import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  History,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBanner, type BannerMessage } from '../components/StatusBanner';
import { api } from '../lib/api';
import { formatDisplayDateTime, formatNumberValue } from '../lib/formatters';
import type { Simulation, SimulationRun } from '../types';

interface HistoryHelpPageProps {
  simulations: Simulation[];
  runs: SimulationRun[];
  onOpenRun: (run: SimulationRun) => void;
  onRefresh: () => Promise<void>;
}

const HELP_TOPICS = [
  {
    q: '1. What is a Markov Chain?',
    a: 'A Markov Chain is a mathematical model describing a system that moves between distinct states over discrete time steps. Its defining rule is the Markov Property ("memorylessness"): the future distribution depends only on the current state distribution, not on the full history of how the population arrived there.',
  },
  {
    q: '2. What is a Transition Matrix (P)?',
    a: 'A transition matrix P is a square n × n table of probabilities governing movement between n states. Under the column-vector convention used in Markov Lab, entry P[i, j] gives the probability of moving FROM column state j TO row state i in one step. Every entry must lie between 0 and 1, and every column must sum to exactly 1.',
  },
  {
    q: '3. What are Initial Population Distributions v(0)?',
    a: 'The initial vector v(0) specifies the starting state at time step k = 0. You can represent v(0) either as a Probability Distribution (where entries are shares between 0 and 1 summing to 1.0, e.g., [0.6, 0.4]ᵀ) or as Actual Population Counts (e.g., [6000, 4000]ᵀ people). Because columns of P sum to 1, total population is conserved across all future periods.',
  },
  {
    q: '4. How Does the Simulator Work?',
    a: 'Starting from v(0), the simulator repeatedly applies matrix multiplication: v(k + 1) = P × v(k). Each iteration computes the next period distribution, tracks period-over-period population changes Δv(k) = v(k) − v(k − 1), and plots how shares evolve over time.',
  },
  {
    q: '5. What are Eigenvalues and Eigenvectors?',
    a: 'An eigenvector v of matrix P is a special direction that is only scaled by a scalar eigenvalue λ when multiplied by P (Pv = λv). Every valid column-stochastic matrix always has a dominant eigenvalue λ₁ = 1. All remaining eigenvalues satisfy |λ| ≤ 1; their magnitudes determine how quickly oscillations decay and how fast the system reaches equilibrium.',
  },
  {
    q: '6. What is a Steady-State Distribution (π)?',
    a: 'A steady-state (or stationary) distribution π is an equilibrium vector that does not change when multiplied by P: Pπ = π with Σπᵢ = 1. When a chain is regular/ergodic, every initial population converges to this unique π in the long run. If a matrix has multiple disconnected absorbing classes or periodic cycles, a unique convergent steady state may not exist.',
  },
];

export function HistoryHelpPage({
  simulations,
  runs,
  onOpenRun,
  onRefresh,
}: HistoryHelpPageProps) {
  const [activeTab, setActiveTab] = useState<'history' | 'help'>('history');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteRunTarget, setDeleteRunTarget] = useState<SimulationRun | null>(null);
  const [deleteSimTarget, setDeleteSimTarget] = useState<Simulation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const filteredRuns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter(
      (r) =>
        r.simulation_name.toLowerCase().includes(q) ||
        r.matrix_name.toLowerCase().includes(q) ||
        r.states.some((s) => s.toLowerCase().includes(q))
    );
  }, [runs, searchQuery]);

  const handleConfirmDeleteRun = async () => {
    if (!deleteRunTarget) return;
    setDeleting(true);
    try {
      await api.deleteRun(deleteRunTarget.id);
      setBanner({
        type: 'success',
        text: `Deleted simulation run #${deleteRunTarget.id} (${deleteRunTarget.simulation_name}).`,
      });
      setDeleteRunTarget(null);
      await onRefresh();
    } catch (err) {
      setBanner({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete run.' });
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmDeleteSim = async () => {
    if (!deleteSimTarget) return;
    setDeleting(true);
    try {
      await api.deleteSimulation(deleteSimTarget.id);
      setBanner({
        type: 'success',
        text: `Deleted simulation "${deleteSimTarget.name}" and its history.`,
      });
      setDeleteSimTarget(null);
      await onRefresh();
    } catch (err) {
      setBanner({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete simulation.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-3xl font-bold text-[#10233F]">History &amp; Help</h1>
          <p className="mt-1 text-sm text-[#4A463F]">
            Reopen past SQLite simulation runs, manage archives, and review Markov Chain theory.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'history'
                ? 'bg-[#10233F] text-white'
                : 'text-[#4A463F] hover:text-[#10233F]'
            }`}
          >
            <History className="h-3.5 w-3.5 text-[#F5A623]" />
            Simulation History
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('help')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'help'
                ? 'bg-[#10233F] text-white'
                : 'text-[#4A463F] hover:text-[#10233F]'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 text-[#F5A623]" />
            Academic Help Guide
          </button>
        </div>
      </div>

      <StatusBanner message={banner} onDismiss={() => setBanner(null)} />

      {activeTab === 'history' ? (
        <div className="space-y-6">
          {/* Past Simulation Runs */}
          <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_10px_rgba(16,35,63,0.05)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="font-heading text-base font-semibold text-[#10233F]">
                Past Simulation Runs ({filteredRuns.length})
              </h2>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B655B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by simulation, matrix, or state..."
                  className="w-full rounded-lg border border-[#D8CFBE] bg-white pl-9 pr-3 py-2 text-xs text-[#292724] focus:border-[#10233F] focus:outline-none"
                />
              </div>
            </div>

            {filteredRuns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#D8CFBE] p-8 text-center text-xs text-[#6B655B]">
                {runs.length === 0
                  ? 'No saved simulation runs in SQLite yet. Run a simulation and save it in Step 7.'
                  : 'No runs match your current search filter.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5DEC9] bg-[#F6F1E7] text-[#10233F]">
                      <th className="py-2.5 px-3 text-left font-semibold">Date &amp; Time</th>
                      <th className="py-2.5 px-3 text-left font-semibold">Simulation Name</th>
                      <th className="py-2.5 px-3 text-left font-semibold">Matrix</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Steps</th>
                      <th className="py-2.5 px-3 text-left font-semibold">Final Distribution</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE9DA]">
                    {filteredRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-[#FAF6ED]">
                        <td className="py-3 px-3 text-[#4A463F] whitespace-nowrap tabular-nums">
                          {formatDisplayDateTime(run.created_at)}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#10233F]">
                          {run.simulation_name}
                        </td>
                        <td className="py-3 px-3 text-[#4A463F]">{run.matrix_name}</td>
                        <td className="py-3 px-3 text-right font-mono-tabular">{run.iterations}</td>
                        <td className="py-3 px-3 font-mono-tabular text-[11px] text-[#292724]">
                          {run.results.finalDistribution
                            .map((val, i) => `${run.states[i]}: ${formatNumberValue(val, run.results.mode)}`)
                            .join(' · ')}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenRun(run)}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#10233F] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#19335A]"
                            >
                              Open Results
                              <ArrowUpRight className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteRunTarget(run)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#F5C2C2] bg-white px-2 py-1.5 text-[11px] font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
                              aria-label={`Delete run ${run.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Saved Simulations Overview */}
          <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_10px_rgba(16,35,63,0.05)] space-y-4">
            <h2 className="font-heading text-base font-semibold text-[#10233F]">
              Saved Simulations Archive ({simulations.length})
            </h2>

            {simulations.length === 0 ? (
              <p className="text-xs text-[#6B655B]">No saved simulations yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5DEC9] bg-[#F6F1E7] text-[#10233F]">
                      <th className="py-2.5 px-3 text-left font-semibold">Created</th>
                      <th className="py-2.5 px-3 text-left font-semibold">Simulation Name</th>
                      <th className="py-2.5 px-3 text-left font-semibold">States</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Matrices</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Runs</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE9DA]">
                    {simulations.map((sim) => (
                      <tr key={sim.id} className="hover:bg-[#FAF6ED]">
                        <td className="py-2.5 px-3 text-[#4A463F] whitespace-nowrap tabular-nums">
                          {formatDisplayDateTime(sim.created_at)}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#10233F]">{sim.name}</td>
                        <td className="py-2.5 px-3 text-[#4A463F]">{sim.states.join(', ')}</td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular">{sim.matrix_count ?? 0}</td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular">{sim.run_count ?? 0}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteSimTarget(sim)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#F5C2C2] bg-white px-2.5 py-1 text-[11px] font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* HELP SECTION */
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-6 shadow-[0_2px_10px_rgba(16,35,63,0.05)] space-y-3">
            <h2 className="font-heading text-lg font-semibold text-[#10233F]">
              Student Presentation &amp; Concept Reference
            </h2>
            <p className="text-xs text-[#5C574E] leading-relaxed">
              Clear, presentation-ready explanations of every mathematical concept behind Markov Lab.
            </p>

            <div className="mt-4 space-y-2.5">
              {HELP_TOPICS.map((topic, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-[#E5DEC9] bg-white overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-[#10233F] hover:bg-[#FAF6ED] transition-colors"
                    >
                      <span>{topic.q}</span>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-[#4D83A8]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-[#4D83A8]" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="border-t border-[#F0E9DA] bg-[#FFFCF6] px-4 py-3.5 text-xs leading-relaxed text-[#4A463F]">
                        {topic.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#E5DEC9] bg-[#10233F] p-5 text-[#F5F0E6] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="font-serif-display italic text-lg text-[#F5A623]">
                v(k + 1) = P &times; v(k) &nbsp;&nbsp;&bull;&nbsp;&nbsp; P&pi; = &pi;
              </div>
              <p className="mt-1 text-xs text-[#D5CCB9]">
                Column-vector convention: columns of P sum to 1.0000, preserving total population across all iterations.
              </p>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteRunTarget)}
        title="Delete Simulation Run"
        message={
          deleteRunTarget
            ? `Delete saved Run #${deleteRunTarget.id} (${deleteRunTarget.simulation_name}) from SQLite?`
            : ''
        }
        onConfirm={handleConfirmDeleteRun}
        onCancel={() => setDeleteRunTarget(null)}
        loading={deleting}
      />

      <ConfirmDialog
        open={Boolean(deleteSimTarget)}
        title="Delete Simulation Model"
        message={
          deleteSimTarget
            ? `Delete "${deleteSimTarget.name}" and all of its matrices and saved runs from SQLite?`
            : ''
        }
        onConfirm={handleConfirmDeleteSim}
        onCancel={() => setDeleteSimTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
