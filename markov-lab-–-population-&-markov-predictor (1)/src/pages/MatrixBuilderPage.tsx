import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Edit3,
  Grid3X3,
  Info,
  PlayCircle,
  RefreshCw,
  Save,
  Sliders,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBanner, type BannerMessage } from '../components/StatusBanner';
import { api } from '../lib/api';
import { formatDisplayDateTime } from '../lib/formatters';
import {
  generateRandomStochasticMatrix,
  normalizeMatrixColumns,
  validateTransitionMatrix,
} from '../lib/markovMath';
import type { PageId, Simulation, TransitionMatrix } from '../types';

interface MatrixBuilderPageProps {
  simulations: Simulation[];
  matrices: TransitionMatrix[];
  initialSimulationId?: number | null;
  onRefresh: () => Promise<void>;
  onNavigateWithSim: (page: PageId, simId: number, matrixId?: number) => void;
}

function createIdentityMatrix(n: number): number[][] {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}

export function MatrixBuilderPage({
  simulations,
  matrices,
  initialSimulationId,
  onRefresh,
  onNavigateWithSim,
}: MatrixBuilderPageProps) {
  const [selectedSimId, setSelectedSimId] = useState<number | ''>(
    initialSimulationId ?? simulations[0]?.id ?? ''
  );
  const [method, setMethod] = useState<'manual' | 'automatic'>('manual');
  const [autoProfile, setAutoProfile] = useState<'high-retention' | 'balanced' | 'high-mobility'>(
    'high-retention'
  );
  const [editingMatrixId, setEditingMatrixId] = useState<number | null>(null);
  const [matrixName, setMatrixName] = useState('');
  const [grid, setGrid] = useState<number[][]>(createIdentityMatrix(3));
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransitionMatrix | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (initialSimulationId) {
      setSelectedSimId(initialSimulationId);
    } else if (!selectedSimId && simulations.length > 0) {
      setSelectedSimId(simulations[0].id);
    }
  }, [initialSimulationId, simulations, selectedSimId]);

  const activeSim = useMemo(
    () => simulations.find((s) => s.id === Number(selectedSimId)) ?? null,
    [simulations, selectedSimId]
  );

  // Reset grid size when simulation changes (unless loading an edit for that sim)
  useEffect(() => {
    if (!activeSim) return;
    if (editingMatrixId) {
      const mat = matrices.find((m) => m.id === editingMatrixId);
      if (mat && mat.simulation_id === activeSim.id) return;
    }
    setEditingMatrixId(null);
    const n = activeSim.states.length;
    if (method === 'automatic') {
      setGrid(generateRandomStochasticMatrix(n, autoProfile));
      setMatrixName(`${activeSim.name} – Auto Matrix`);
    } else {
      setGrid(createIdentityMatrix(n));
      setMatrixName('');
    }
  }, [activeSim?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const simMatrices = useMemo(
    () => matrices.filter((m) => m.simulation_id === activeSim?.id),
    [matrices, activeSim]
  );

  const validation = useMemo(() => validateTransitionMatrix(grid), [grid]);

  const handleSwitchMethod = (nextMethod: 'manual' | 'automatic') => {
    setMethod(nextMethod);
    setBanner(null);
    if (!activeSim) return;
    const n = activeSim.states.length;
    if (nextMethod === 'automatic' && !editingMatrixId) {
      setGrid(generateRandomStochasticMatrix(n, autoProfile));
      if (!matrixName.trim()) {
        setMatrixName(`${activeSim.name} – Auto Matrix`);
      }
    }
  };

  const handleRegenerateAuto = () => {
    if (!activeSim) return;
    setGrid(generateRandomStochasticMatrix(activeSim.states.length, autoProfile));
    setBanner({
      type: 'info',
      text: 'Generated a new valid column-stochastic transition matrix. You may refine any cell before saving.',
    });
  };

  const handleCellChange = (row: number, col: number, rawVal: string) => {
    const parsed = rawVal === '' ? 0 : Number(rawVal);
    setGrid((prev) =>
      prev.map((r, i) => r.map((v, j) => (i === row && j === col ? (Number.isFinite(parsed) ? parsed : 0) : v)))
    );
  };

  const handleNormalize = () => {
    setGrid((prev) => normalizeMatrixColumns(prev));
    setBanner({
      type: 'info',
      text: 'Normalized every column proportionally so all column sums equal 1.0000.',
    });
  };

  const handleEditExisting = (mat: TransitionMatrix) => {
    setSelectedSimId(mat.simulation_id);
    setEditingMatrixId(mat.id);
    setMethod(mat.generation_type);
    setMatrixName(mat.matrix_name);
    setGrid(mat.matrix_data.map((r) => [...r]));
    setBanner(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingMatrixId(null);
    setMatrixName('');
    if (activeSim) {
      setGrid(
        method === 'automatic'
          ? generateRandomStochasticMatrix(activeSim.states.length, autoProfile)
          : createIdentityMatrix(activeSim.states.length)
      );
    }
  };

  const handleSaveMatrix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSim) {
      setBanner({ type: 'error', text: 'Please select a simulation first.' });
      return;
    }
    const trimmedName = matrixName.trim();
    if (!trimmedName) {
      setBanner({ type: 'error', text: 'Please enter a matrix name before saving.' });
      return;
    }
    if (!validation.valid) {
      setBanner({
        type: 'error',
        text: validation.errors[0] || 'Matrix validation failed. Every column must sum to 1.',
      });
      return;
    }

    setSaving(true);
    setBanner(null);
    try {
      if (editingMatrixId) {
        await api.updateMatrix(editingMatrixId, {
          matrix_name: trimmedName,
          matrix_data: grid,
          generation_type: method,
        });
        setBanner({ type: 'success', text: `Matrix "${trimmedName}" updated in SQLite.` });
        setEditingMatrixId(null);
      } else {
        await api.createMatrix({
          simulation_id: activeSim.id,
          matrix_name: trimmedName,
          matrix_data: grid,
          generation_type: method,
        });
        setBanner({ type: 'success', text: `Matrix "${trimmedName}" saved to SQLite.` });
      }
      setMatrixName('');
      await onRefresh();
    } catch (err) {
      setBanner({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save matrix.' });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteMatrix(deleteTarget.id);
      if (editingMatrixId === deleteTarget.id) handleCancelEdit();
      setBanner({ type: 'success', text: `Deleted matrix "${deleteTarget.matrix_name}".` });
      setDeleteTarget(null);
      await onRefresh();
    } catch (err) {
      setBanner({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete matrix.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-3xl font-bold text-[#10233F]">Matrix Builder</h1>
          <p className="mt-1 text-sm text-[#4A463F]">
            Construct or automatically generate validated column-stochastic transition matrices.
          </p>
        </div>

        {activeSim && (
          <div className="flex items-center gap-2">
            <label htmlFor="matrix-sim-select" className="text-xs font-semibold text-[#10233F]">
              Target Model:
            </label>
            <select
              id="matrix-sim-select"
              value={selectedSimId}
              onChange={(e) => {
                setEditingMatrixId(null);
                setSelectedSimId(Number(e.target.value));
              }}
              className="rounded-lg border border-[#D8CFBE] bg-[#FFFCF6] px-3 py-2 text-sm font-medium text-[#10233F] focus:border-[#10233F] focus:outline-none"
            >
              {simulations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.states.length} states)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <StatusBanner message={banner} onDismiss={() => setBanner(null)} />

      {simulations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D8CFBE] bg-[#FFFCF6] p-10 text-center">
          <p className="font-heading text-base font-semibold text-[#10233F]">
            No Simulations Available
          </p>
          <p className="mt-1.5 text-sm text-[#5C574E]">
            Create a simulation with at least 2 population states before building a transition matrix.
          </p>
          <button
            type="button"
            onClick={() => onNavigateWithSim('simulation-manager', 0)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#10233F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#19335A]"
          >
            Go to Simulation Manager
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        activeSim && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left: Matrix Editor */}
            <form
              onSubmit={handleSaveMatrix}
              className="xl:col-span-8 rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-6 shadow-[0_2px_10px_rgba(16,35,63,0.05)] space-y-5"
            >
              {/* Method Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#EFE9DA]">
                <div className="inline-flex rounded-lg bg-[#F5F0E6] p-1 border border-[#E5DEC9]">
                  <button
                    type="button"
                    onClick={() => handleSwitchMethod('manual')}
                    className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      method === 'manual'
                        ? 'bg-[#10233F] text-white shadow-xs'
                        : 'text-[#4A463F] hover:text-[#10233F]'
                    }`}
                  >
                    <Sliders className="h-3.5 w-3.5" />
                    A. Manual Matrix Creation
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMethod('automatic')}
                    className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      method === 'automatic'
                        ? 'bg-[#F5A623] text-[#10233F] shadow-xs'
                        : 'text-[#4A463F] hover:text-[#10233F]'
                    }`}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    B. Automatic Generation
                  </button>
                </div>

                {editingMatrixId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-xs font-semibold text-[#4D83A8] hover:underline"
                  >
                    Cancel Editing Matrix
                  </button>
                )}
              </div>

              {/* Automatic Generation Toolbar */}
              {method === 'automatic' && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#F3DFB6] bg-[#FFF8EB] px-4 py-3">
                  <div className="flex items-center gap-2.5 text-xs font-medium text-[#10233F]">
                    <Wand2 className="h-4 w-4 text-[#D9820B] shrink-0" />
                    <span>
                      <strong>Automatically Generated Matrix</strong> &mdash; All columns sum to 1.0000. Edit any cell below before saving.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Generation profile"
                      value={autoProfile}
                      onChange={(e) => {
                        const prof = e.target.value as 'high-retention' | 'balanced' | 'high-mobility';
                        setAutoProfile(prof);
                        setGrid(generateRandomStochasticMatrix(activeSim.states.length, prof));
                      }}
                      className="rounded-lg border border-[#D8CFBE] bg-white px-2.5 py-1.5 text-xs font-medium text-[#10233F]"
                    >
                      <option value="high-retention">High Retention (Diagonal Dominant)</option>
                      <option value="balanced">Balanced Mobility</option>
                      <option value="high-mobility">High Mobility (Dynamic Shifts)</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleRegenerateAuto}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5A623] px-3 py-1.5 text-xs font-semibold text-[#10233F] hover:bg-[#E59716] transition-colors whitespace-nowrap"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Regenerate
                    </button>
                  </div>
                </div>
              )}

              {/* Matrix Name Input */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                <div className="sm:col-span-8">
                  <label htmlFor="matrix-name" className="block text-xs font-semibold text-[#10233F] mb-1.5">
                    Matrix Name *
                  </label>
                  <input
                    id="matrix-name"
                    type="text"
                    value={matrixName}
                    onChange={(e) => setMatrixName(e.target.value)}
                    placeholder={
                      method === 'automatic'
                        ? `${activeSim.name} – Auto Matrix`
                        : 'e.g., Baseline Migration Matrix'
                    }
                    className="w-full rounded-lg border border-[#D8CFBE] bg-white px-3.5 py-2 text-sm text-[#292724] focus:border-[#10233F] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNormalize}
                    className="w-full sm:w-auto rounded-lg border border-[#4D83A8] bg-[#4D83A8]/10 px-3.5 py-2 text-xs font-semibold text-[#10233F] hover:bg-[#4D83A8] hover:text-white transition-colors whitespace-nowrap"
                  >
                    Normalize Columns to 1
                  </button>
                </div>
              </div>

              {/* Matrix Grid Table */}
              <div className="overflow-x-auto rounded-xl border border-[#E5DEC9] bg-white p-3">
                <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-[#6B655B]">
                  <span>Rows = Destination State (To) &middot; Columns = Origin State (From)</span>
                  <span className="font-serif-display italic text-[#10233F]">
                    v(k+1) = P &times; v(k)
                  </span>
                </div>

                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-xs font-semibold text-[#6B655B] border-b border-[#EFE9DA]">
                        To \ From
                      </th>
                      {activeSim.states.map((st, j) => (
                        <th
                          key={j}
                          className="p-2 text-center text-xs font-semibold text-[#10233F] border-b border-[#EFE9DA] min-w-[105px]"
                        >
                          <div className="truncate max-w-[130px] mx-auto" title={st}>
                            {st}
                          </div>
                          <div className="text-[10px] font-normal text-[#6B655B]">Col {j + 1}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeSim.states.map((rowState, i) => (
                      <tr key={i} className="border-b border-[#F5F0E6]">
                        <td className="p-2 text-xs font-semibold text-[#10233F] max-w-[150px] truncate" title={rowState}>
                          {rowState}
                        </td>
                        {activeSim.states.map((_, j) => {
                          const hasErr = validation.entryErrors.some((e) => e.row === i && e.col === j);
                          return (
                            <td key={j} className="p-1.5">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="1"
                                aria-label={`Probability from ${activeSim.states[j]} to ${rowState}`}
                                value={grid[i]?.[j] ?? 0}
                                onChange={(e) => handleCellChange(i, j, e.target.value)}
                                className={`w-full rounded-lg border px-2.5 py-2 text-center font-mono-tabular text-sm focus:outline-none ${
                                  hasErr
                                    ? 'border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]'
                                    : i === j
                                      ? 'border-[#C9D9E6] bg-[#F5F9FC] text-[#10233F] font-semibold focus:border-[#10233F]'
                                      : 'border-[#D8CFBE] bg-white text-[#292724] focus:border-[#10233F]'
                                }`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#FAF6ED]">
                      <td className="p-2 text-xs font-semibold text-[#10233F]">Column Sum (&Sigma;)</td>
                      {validation.columnSums.map((sum, j) => {
                        const bad = validation.columnErrors[j];
                        return (
                          <td key={j} className="p-2 text-center font-mono-tabular text-xs font-bold">
                            <span
                              className={`inline-flex items-center justify-center gap-1 ${
                                bad ? 'text-[#B91C1C]' : 'text-[#15803D]'
                              }`}
                            >
                              {sum.toFixed(4)}
                              {bad ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Validation Feedback */}
              {!validation.valid ? (
                <div className="rounded-lg border border-[#F5C2C2] bg-[#FEF2F2] p-3.5 text-xs text-[#991B1B] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Matrix Validation Errors
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {validation.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-lg border border-[#BBDFCC] bg-[#EAF7F0] px-3.5 py-2.5 text-xs font-medium text-[#14532D] flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Valid column-stochastic matrix: every probability is in [0, 1] and every column sums to 1.0000.
                  </span>
                </div>
              )}

              {/* Academic Explanation Box */}
              <div className="rounded-lg border border-[#E5DEC9] bg-[#F5F0E6]/65 p-4 text-xs leading-relaxed text-[#4A463F]">
                <div className="flex items-center gap-1.5 font-semibold text-[#10233F] mb-1">
                  <Info className="h-4 w-4 text-[#4D83A8]" />
                  <span>Understanding the Column-Vector Transition Matrix</span>
                </div>
                <p>
                  Each entry <span className="font-mono-tabular font-semibold">P[i, j]</span> represents the
                  probability that an individual currently in <strong>column state j</strong> moves to{' '}
                  <strong>row state i</strong> in one time step. Because every member of state{' '}
                  <em>j</em> must either remain in state <em>j</em> or transition to another state, every
                  column must sum to exactly <strong>1</strong>.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving || !validation.valid}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#10233F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#19335A] transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>
                  {saving
                    ? 'Saving Matrix...'
                    : editingMatrixId
                      ? 'Update Transition Matrix'
                      : 'Save Transition Matrix'}
                </span>
              </button>
            </form>

            {/* Right: Saved Matrices for Selected Simulation */}
            <div className="xl:col-span-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-base font-semibold text-[#10233F]">
                  Saved Matrices ({simMatrices.length})
                </h2>
              </div>

              {simMatrices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D8CFBE] bg-[#FFFCF6] p-8 text-center">
                  <Grid3X3 className="mx-auto h-8 w-8 text-[#4D83A8]/60" />
                  <p className="mt-2 font-heading text-sm font-semibold text-[#10233F]">
                    No Matrices Saved for {activeSim.name}
                  </p>
                  <p className="mt-1 text-xs text-[#6B655B]">
                    Enter probabilities manually or switch to Automatic Generation to save your first matrix.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {simMatrices.map((mat) => (
                    <div
                      key={mat.id}
                      className={`rounded-xl border bg-[#FFFCF6] p-4 shadow-[0_2px_8px_rgba(16,35,63,0.04)] ${
                        editingMatrixId === mat.id
                          ? 'border-[#F5A623] ring-1 ring-[#F5A623]'
                          : 'border-[#E5DEC9]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-heading text-sm font-semibold text-[#10233F] truncate">
                            {mat.matrix_name}
                          </h3>
                          <div className="mt-0.5 text-[11px] text-[#6B655B]">
                            <span>
                              {mat.generation_type === 'automatic'
                                ? 'Automatically Generated'
                                : 'Manually Created'}
                            </span>
                            <span className="mx-1.5">&middot;</span>
                            <span>{formatDisplayDateTime(mat.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditExisting(mat)}
                            title="Edit matrix"
                            className="rounded-md border border-[#D8CFBE] bg-white p-1.5 text-[#10233F] hover:bg-[#F5F0E6]"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(mat)}
                            title="Delete matrix"
                            className="rounded-md border border-[#F5C2C2] bg-white p-1.5 text-[#B91C1C] hover:bg-[#FEF2F2]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Mini Preview */}
                      <div className="mt-3 overflow-x-auto rounded-lg border border-[#EFE9DA] bg-[#FAF6ED] p-2">
                        <table className="w-full text-center font-mono-tabular text-[11px] text-[#10233F]">
                          <tbody>
                            {mat.matrix_data.map((row, ri) => (
                              <tr key={ri}>
                                {row.map((val, ci) => (
                                  <td key={ci} className="px-1.5 py-0.5">
                                    {val.toFixed(2)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button
                        type="button"
                        onClick={() => onNavigateWithSim('markov-simulator', mat.simulation_id, mat.id)}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#10233F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#19335A] transition-colors"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Use in Simulator
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Transition Matrix"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.matrix_name}"? Any saved simulation runs that used this matrix will also be removed.`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
