import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Grid3X3,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Save,
} from 'lucide-react';
import type { Data } from 'plotly.js-dist-min';
import { useEffect, useMemo, useState } from 'react';
import { CHART_PALETTE, PlotlyChart } from '../components/PlotlyChart';
import { StatusBanner, type BannerMessage } from '../components/StatusBanner';
import { api } from '../lib/api';
import { formatNumberValue } from '../lib/formatters';
import {
  generateRandomStochasticMatrix,
  runMarkovSimulation,
  validateInitialPopulation,
  validateTransitionMatrix,
} from '../lib/markovMath';
import type {
  PageId,
  PopulationMode,
  Simulation,
  SimulationResultsPayload,
  SimulationRun,
  TransitionMatrix,
} from '../types';

interface MarkovSimulatorPageProps {
  simulations: Simulation[];
  matrices: TransitionMatrix[];
  initialSimulationId?: number | null;
  initialMatrixId?: number | null;
  loadedRun?: SimulationRun | null;
  onClearLoadedRun: () => void;
  onRefresh: () => Promise<void>;
  onNavigate: (page: PageId) => void;
}

const STEPS = [
  { step: 1, label: 'Select Simulation' },
  { step: 2, label: 'Transition Matrix' },
  { step: 3, label: 'Initial Population' },
  { step: 4, label: 'Settings' },
  { step: 5, label: 'Run' },
  { step: 6, label: 'Results' },
  { step: 7, label: 'Save' },
];

export function MarkovSimulatorPage({
  simulations,
  matrices,
  initialSimulationId,
  initialMatrixId,
  loadedRun,
  onClearLoadedRun,
  onRefresh,
  onNavigate,
}: MarkovSimulatorPageProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedSimId, setSelectedSimId] = useState<number | ''>(
    initialSimulationId ?? simulations[0]?.id ?? ''
  );
  const [selectedMatrixId, setSelectedMatrixId] = useState<number | ''>(initialMatrixId ?? '');
  const [popMode, setPopMode] = useState<PopulationMode>('probability');
  const [initialValues, setInitialValues] = useState<number[]>([]);
  const [iterations, setIterations] = useState<number>(5);
  const [unitLabel, setUnitLabel] = useState<string>('Step');
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedRunId, setSavedRunId] = useState<number | null>(null);
  const [results, setResults] = useState<SimulationResultsPayload | null>(null);
  const [chartDisplayMode, setChartDisplayMode] = useState<'native' | 'share'>('native');
  const [banner, setBanner] = useState<BannerMessage | null>(null);

  // Quick-create inline simulation state
  const [showQuickSim, setShowQuickSim] = useState(false);
  const [quickSimName, setQuickSimName] = useState('');
  const [quickStatesText, setQuickStatesText] = useState('Urban, Rural, Migrated');

  // Quick-generate inline matrix state
  const [quickMatLoading, setQuickMatLoading] = useState(false);

  // Load previously saved run if passed from Dashboard or History
  useEffect(() => {
    if (!loadedRun) return;
    setSelectedSimId(loadedRun.simulation_id);
    setSelectedMatrixId(loadedRun.matrix_id);
    setPopMode(loadedRun.initial_population.mode);
    setInitialValues(loadedRun.initial_population.values);
    setUnitLabel(loadedRun.initial_population.unitLabel || 'Step');
    setIterations(loadedRun.iterations);
    setResults(loadedRun.results);
    setSavedRunId(loadedRun.id);
    setCurrentStep(6);
    setBanner({
      type: 'info',
      text: `Viewing saved simulation run #${loadedRun.id} (${loadedRun.simulation_name}).`,
    });
  }, [loadedRun]);

  useEffect(() => {
    if (loadedRun) return;
    if (initialSimulationId) {
      setSelectedSimId(initialSimulationId);
    } else if (!selectedSimId && simulations.length > 0) {
      setSelectedSimId(simulations[0].id);
    }
  }, [initialSimulationId, simulations, selectedSimId, loadedRun]);

  useEffect(() => {
    if (loadedRun) return;
    if (initialMatrixId) {
      setSelectedMatrixId(initialMatrixId);
    }
  }, [initialMatrixId, loadedRun]);

  const activeSim = useMemo(
    () => simulations.find((s) => s.id === Number(selectedSimId)) ?? null,
    [simulations, selectedSimId]
  );

  const availableMatrices = useMemo(
    () => matrices.filter((m) => m.simulation_id === activeSim?.id),
    [matrices, activeSim]
  );

  const activeMatrix = useMemo(
    () => availableMatrices.find((m) => m.id === Number(selectedMatrixId)) ?? null,
    [availableMatrices, selectedMatrixId]
  );

  // Auto-select first matrix & default initial values when active simulation changes
  useEffect(() => {
    if (!activeSim || loadedRun) return;
    if (!availableMatrices.some((m) => m.id === Number(selectedMatrixId))) {
      setSelectedMatrixId(availableMatrices[0]?.id ?? '');
    }
    if (initialValues.length !== activeSim.states.length) {
      const n = activeSim.states.length;
      if (popMode === 'probability') {
        const base = Number((1 / n).toFixed(4));
        const arr = Array(n).fill(base);
        arr[0] = Number((1 - base * (n - 1)).toFixed(4));
        setInitialValues(arr);
      } else {
        setInitialValues(Array(n).fill(1000));
      }
    }
  }, [activeSim?.id, availableMatrices.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const matrixValidation = useMemo(
    () => (activeMatrix ? validateTransitionMatrix(activeMatrix.matrix_data) : null),
    [activeMatrix]
  );

  const popValidation = useMemo(
    () => validateInitialPopulation(initialValues, popMode),
    [initialValues, popMode]
  );

  const handleModeSwitch = (nextMode: PopulationMode) => {
    if (nextMode === popMode || !activeSim) return;
    setPopMode(nextMode);
    const total = initialValues.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    if (nextMode === 'probability') {
      if (total > 0) {
        const normalized = initialValues.map((v) => Math.round((v / total) * 10000) / 10000);
        const diff = Math.round((1 - normalized.reduce((a, b) => a + b, 0)) * 10000) / 10000;
        normalized[0] = Math.max(0, Math.round((normalized[0] + diff) * 10000) / 10000);
        setInitialValues(normalized);
      } else {
        const n = activeSim.states.length;
        setInitialValues(Array.from({ length: n }, (_, i) => (i === 0 ? 1 : 0)));
      }
    } else {
      // Scale probability shares to 10,000 total population as clean starting counts
      setInitialValues(initialValues.map((v) => Math.round(v * 10000)));
    }
  };

  const handleQuickCreateSimulation = async () => {
    const parsedStates = quickStatesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!quickSimName.trim() || parsedStates.length < 2) {
      setBanner({ type: 'error', text: 'Provide a simulation name and at least 2 comma-separated states.' });
      return;
    }
    try {
      const created = await api.createSimulation({
        name: quickSimName.trim(),
        description: 'Created from Markov Simulator Step 1',
        states: parsedStates,
      });
      await onRefresh();
      setSelectedSimId(created.id);
      setInitialValues(
        Array.from({ length: created.states.length }, (_, i) =>
          i === 0 ? Number((1 - Math.floor((1 / created.states.length) * 10000) / 10000 * (created.states.length - 1)).toFixed(4)) : Math.floor((1 / created.states.length) * 10000) / 10000
        )
      );
      setShowQuickSim(false);
      setQuickSimName('');
      setBanner({ type: 'success', text: `Created simulation "${created.name}".` });
    } catch (err) {
      setBanner({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create simulation.' });
    }
  };

  const handleQuickAutoMatrix = async () => {
    if (!activeSim) return;
    setQuickMatLoading(true);
    try {
      const autoGrid = generateRandomStochasticMatrix(activeSim.states.length, 'high-retention');
      const created = await api.createMatrix({
        simulation_id: activeSim.id,
        matrix_name: `${activeSim.name} – Auto Matrix`,
        matrix_data: autoGrid,
        generation_type: 'automatic',
      });
      await onRefresh();
      setSelectedMatrixId(created.id);
      setBanner({
        type: 'success',
        text: `Generated and saved valid automatic matrix "${created.matrix_name}".`,
      });
    } catch (err) {
      setBanner({ type: 'error', text: err instanceof Error ? err.message : 'Failed to generate matrix.' });
    } finally {
      setQuickMatLoading(false);
    }
  };

  const handleRunSimulation = () => {
    if (!activeSim || !activeMatrix) {
      setBanner({ type: 'error', text: 'Please select both a simulation and a valid transition matrix.' });
      return;
    }
    if (!matrixValidation?.valid) {
      setBanner({ type: 'error', text: 'Selected transition matrix failed stochastic validation.' });
      return;
    }
    if (!popValidation.valid) {
      setBanner({ type: 'error', text: popValidation.error || 'Invalid initial population distribution.' });
      return;
    }

    onClearLoadedRun();
    setSavedRunId(null);
    setRunning(true);
    setBanner(null);

    // Brief deliberate calculation feedback for multi-step computation
    setTimeout(() => {
      const computed = runMarkovSimulation(
        activeMatrix.matrix_data,
        initialValues,
        iterations,
        popMode
      );
      setResults(computed);
      setRunning(false);
      setCurrentStep(6);
    }, 260);
  };

  const handleSaveRun = async () => {
    if (!activeSim || !activeMatrix || !results) return;
    setSaving(true);
    setBanner(null);
    try {
      const saved = await api.createRun({
        simulation_id: activeSim.id,
        matrix_id: activeMatrix.id,
        initial_population: {
          mode: popMode,
          values: initialValues,
          unitLabel,
        },
        iterations,
        results,
      });
      setSavedRunId(saved.id);
      setCurrentStep(7);
      await onRefresh();
      setBanner({
        type: 'success',
        text: `Simulation Run #${saved.id} saved to SQLite! It is now visible on Dashboard and History.`,
      });
    } catch (err) {
      setBanner({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save simulation run.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    onClearLoadedRun();
    setResults(null);
    setSavedRunId(null);
    setCurrentStep(1);
    setBanner(null);
  };

  // Plotly chart data for Step 6
  const lineTraces: Data[] = useMemo(() => {
    if (!results || !activeSim) return [];
    const useShare = results.mode === 'probability' || chartDisplayMode === 'share';
    const seriesMatrix = useShare ? results.normalizedTrajectory : results.trajectory;
    return activeSim.states.map((st, idx) => ({
      type: 'scatter',
      mode: 'lines+markers',
      name: st,
      x: seriesMatrix.map((_, stepIdx) => `${unitLabel} ${stepIdx}`),
      y: seriesMatrix.map((vec) => vec[idx] ?? 0),
      line: { color: CHART_PALETTE[idx % CHART_PALETTE.length], width: 2.5 },
      marker: { color: CHART_PALETTE[idx % CHART_PALETTE.length], size: 6 },
      hovertemplate: useShare
        ? `<b>${st}</b><br>%{x}: %{y:.4f}<extra></extra>`
        : `<b>${st}</b><br>%{x}: %{y:,.2f}<extra></extra>`,
    }));
  }, [results, activeSim, chartDisplayMode, unitLabel]);

  const comparisonBarTraces: Data[] = useMemo(() => {
    if (!results || !activeSim) return [];
    const useShare = results.mode === 'probability' || chartDisplayMode === 'share';
    const initialVec = useShare ? results.normalizedTrajectory[0] : results.trajectory[0];
    const finalVec = useShare
      ? results.normalizedTrajectory[results.normalizedTrajectory.length - 1]
      : results.finalDistribution;
    return [
      {
        type: 'bar',
        name: `Initial (${unitLabel} 0)`,
        x: activeSim.states,
        y: initialVec,
        marker: { color: '#4D83A8' },
      },
      {
        type: 'bar',
        name: `Predicted (${unitLabel} ${iterations})`,
        x: activeSim.states,
        y: finalVec,
        marker: { color: '#10233F' },
      },
    ];
  }, [results, activeSim, chartDisplayMode, unitLabel, iterations]);

  return (
    <div className="space-y-6 pb-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-3xl font-bold text-[#10233F]">Markov Simulator</h1>
          <p className="mt-1 text-sm text-[#4A463F]">
            Guided step-by-step population projection using <span className="font-serif-display italic">v(k+1) = P &times; v(k)</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8CFBE] bg-[#FFFCF6] px-3.5 py-2 text-xs font-semibold text-[#10233F] hover:bg-[#EDE6D8] transition-colors self-start"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          New Simulation Run
        </button>
      </div>

      {/* 7-Step Progress Bar */}
      <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-4 shadow-[0_2px_8px_rgba(16,35,63,0.04)] overflow-x-auto">
        <div className="flex items-center justify-between min-w-[660px] gap-2">
          {STEPS.map((item, idx) => {
            const isCurrent = currentStep === item.step;
            const isDone =
              item.step < currentStep ||
              (item.step === 6 && results !== null) ||
              (item.step === 7 && savedRunId !== null);
            const canClick =
              item.step <= 5 ||
              (item.step >= 6 && results !== null);

            return (
              <div key={item.step} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  disabled={!canClick}
                  onClick={() => canClick && setCurrentStep(item.step)}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    isCurrent
                      ? 'bg-[#F5A623] text-[#10233F] shadow-xs'
                      : isDone
                        ? 'bg-[#10233F] text-white'
                        : 'bg-[#F5F0E6] text-[#6B655B]'
                  } ${!canClick ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="tabular-nums">Step {item.step}</span>
                  <span className="hidden md:inline">&middot; {item.label}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`mx-2 h-[2px] flex-1 ${
                      isDone ? 'bg-[#10233F]' : 'bg-[#E5DEC9]'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <StatusBanner message={banner} onDismiss={() => setBanner(null)} />

      {/* STEP 1: SELECT SIMULATION */}
      {currentStep === 1 && (
        <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-6 shadow-[0_2px_10px_rgba(16,35,63,0.05)] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold text-[#10233F]">
                Step 1 &ndash; Select Simulation
              </h2>
              <p className="text-xs text-[#5C574E]">
                Choose an existing population model from SQLite or quickly create a new one.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickSim(!showQuickSim)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#4D83A8] bg-[#4D83A8]/10 px-3.5 py-2 text-xs font-semibold text-[#10233F] hover:bg-[#4D83A8] hover:text-white transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Quick Create Simulation
            </button>
          </div>

          {showQuickSim && (
            <div className="rounded-xl border border-[#D8CFBE] bg-[#F5F0E6]/60 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#10233F] mb-1">
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={quickSimName}
                    onChange={(e) => setQuickSimName(e.target.value)}
                    placeholder="e.g., Campus Housing Shift"
                    className="w-full rounded-lg border border-[#D8CFBE] bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#10233F] mb-1">
                    States (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={quickStatesText}
                    onChange={(e) => setQuickStatesText(e.target.value)}
                    placeholder="On-Campus, Off-Campus, Commuter"
                    className="w-full rounded-lg border border-[#D8CFBE] bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickSim(false)}
                  className="rounded-lg border border-[#D8CFBE] bg-white px-3 py-1.5 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleQuickCreateSimulation}
                  className="rounded-lg bg-[#10233F] px-3.5 py-1.5 text-xs font-semibold text-white"
                >
                  Save &amp; Select
                </button>
              </div>
            </div>
          )}

          {simulations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D8CFBE] p-8 text-center text-sm text-[#5C574E]">
              No simulations saved yet. Click <strong>Quick Create Simulation</strong> above or visit the Simulation Manager.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {simulations.map((sim) => {
                const selected = sim.id === Number(selectedSimId);
                return (
                  <button
                    key={sim.id}
                    type="button"
                    onClick={() => {
                      setSelectedSimId(sim.id);
                      setInitialValues([]);
                    }}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      selected
                        ? 'border-[#F5A623] bg-[#FFF9ED] ring-1 ring-[#F5A623]'
                        : 'border-[#E5DEC9] bg-white hover:border-[#4D83A8]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-heading text-sm font-semibold text-[#10233F]">
                        {sim.name}
                      </span>
                      <span className="text-xs font-semibold text-[#4D83A8] tabular-nums">
                        {sim.states.length} states
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#5C574E] line-clamp-2">
                      {sim.description || 'No description'}
                    </p>
                    <div className="mt-2 text-[11px] font-medium text-[#10233F]">
                      {sim.states.join(' · ')}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={!activeSim}
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#10233F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#19335A] disabled:opacity-50"
            >
              Next: Select Transition Matrix
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: SELECT TRANSITION MATRIX */}
      {currentStep === 2 && activeSim && (
        <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-6 shadow-[0_2px_10px_rgba(16,35,63,0.05)] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold text-[#10233F]">
                Step 2 &ndash; Select Transition Matrix ({activeSim.name})
              </h2>
              <p className="text-xs text-[#5C574E]">
                Choose a saved manual or automatically generated transition matrix, or build one now.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleQuickAutoMatrix}
                disabled={quickMatLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5A623] px-3.5 py-2 text-xs font-semibold text-[#10233F] hover:bg-[#E59716]"
              >
                {quickMatLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Auto-Generate Valid Matrix
              </button>
              <button
                type="button"
                onClick={() => onNavigate('matrix-builder')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8CFBE] bg-white px-3.5 py-2 text-xs font-semibold text-[#10233F] hover:bg-[#F5F0E6]"
              >
                <Grid3X3 className="h-3.5 w-3.5" />
                Open Matrix Builder
              </button>
            </div>
          </div>

          {availableMatrices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D8CFBE] p-8 text-center text-sm text-[#5C574E]">
              No saved transition matrices found for <strong>{activeSim.name}</strong>. Click{' '}
              <strong>Auto-Generate Valid Matrix</strong> or visit <strong>Matrix Builder</strong>.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableMatrices.map((mat) => {
                const selected = mat.id === Number(selectedMatrixId);
                return (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => setSelectedMatrixId(mat.id)}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      selected
                        ? 'border-[#F5A623] bg-[#FFF9ED] ring-1 ring-[#F5A623]'
                        : 'border-[#E5DEC9] bg-white hover:border-[#4D83A8]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-heading text-sm font-semibold text-[#10233F]">
                        {mat.matrix_name}
                      </span>
                      <span className="text-[11px] font-medium text-[#4D83A8]">
                        {mat.generation_type === 'automatic' ? 'Auto Generated' : 'Manual'}
                      </span>
                    </div>
                    <div className="mt-3 overflow-x-auto rounded-lg bg-[#FAF6ED] p-2 border border-[#EFE9DA]">
                      <table className="w-full text-center font-mono-tabular text-xs text-[#10233F]">
                        <tbody>
                          {mat.matrix_data.map((row, rIdx) => (
                            <tr key={rIdx}>
                              {row.map((val, cIdx) => (
                                <td key={cIdx} className="px-2 py-0.5">
                                  {val.toFixed(4)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {activeMatrix && matrixValidation && !matrixValidation.valid && (
            <div className="rounded-lg border border-[#F5C2C2] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]">
              {matrixValidation.errors[0]}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8CFBE] bg-white px-4 py-2.5 text-sm font-semibold text-[#10233F] hover:bg-[#F5F0E6]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              disabled={!activeMatrix || !matrixValidation?.valid}
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#10233F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#19335A] disabled:opacity-50"
            >
              Next: Initial Population
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: INITIAL POPULATION */}
      {currentStep === 3 && activeSim && (
        <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-6 shadow-[0_2px_10px_rgba(16,35,63,0.05)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold text-[#10233F]">
                Step 3 &ndash; Initial Population Vector v(0)
              </h2>
              <p className="text-xs text-[#5C574E]">
                Specify whether you are entering normalized probability shares or actual population counts.
              </p>
            </div>

            <div className="inline-flex rounded-lg bg-[#F5F0E6] p-1 border border-[#E5DEC9]">
              <button
                type="button"
                onClick={() => handleModeSwitch('probability')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  popMode === 'probability'
                    ? 'bg-[#10233F] text-white'
                    : 'text-[#4A463F] hover:text-[#10233F]'
                }`}
              >
                Probability Distribution (&Sigma; = 1)
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('counts')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  popMode === 'counts'
                    ? 'bg-[#10233F] text-white'
                    : 'text-[#4A463F] hover:text-[#10233F]'
                }`}
              >
                Actual Population Counts
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSim.states.map((st, idx) => {
              const val = initialValues[idx] ?? 0;
              const pct = popValidation.total > 0 ? (val / popValidation.total) * 100 : 0;
              return (
                <div key={idx} className="rounded-xl border border-[#E5DEC9] bg-white p-4">
                  <label className="block text-xs font-semibold text-[#10233F] mb-1.5">
                    {st}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={popMode === 'probability' ? '0.01' : '1'}
                    value={val}
                    onChange={(e) => {
                      const nextVal = e.target.value === '' ? 0 : Number(e.target.value);
                      setInitialValues((prev) =>
                        prev.map((x, i) => (i === idx ? (Number.isFinite(nextVal) ? nextVal : 0) : x))
                      );
                    }}
                    className="w-full rounded-lg border border-[#D8CFBE] px-3 py-2 font-mono-tabular text-sm text-[#10233F] focus:border-[#10233F] focus:outline-none"
                  />
                  <div className="mt-1.5 text-[11px] text-[#6B655B] tabular-nums">
                    Share: {pct.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5DEC9] bg-[#FAF6ED] px-4 py-3 text-sm">
            <div>
              <span className="font-semibold text-[#10233F]">
                {popMode === 'probability' ? 'Total Probability Sum: ' : 'Total Population (N): '}
              </span>
              <span className="font-mono-tabular font-bold text-[#10233F]">
                {popMode === 'probability'
                  ? popValidation.total.toFixed(4)
                  : popValidation.total.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
            </div>
            {popMode === 'probability' && !popValidation.valid && popValidation.total > 0 && (
              <button
                type="button"
                onClick={() => {
                  const total = popValidation.total;
                  const normalized = initialValues.map((v) => Math.round((v / total) * 10000) / 10000);
                  const diff = Math.round((1 - normalized.reduce((a, b) => a + b, 0)) * 10000) / 10000;
                  normalized[0] = Math.max(0, Math.round((normalized[0] + diff) * 10000) / 10000);
                  setInitialValues(normalized);
                }}
                className="rounded-lg bg-[#F5A623] px-3 py-1.5 text-xs font-semibold text-[#10233F]"
              >
                Normalize to 1.0000
              </button>
            )}
          </div>

          {!popValidation.valid && (
            <div className="flex items-center gap-2 rounded-lg border border-[#F5C2C2] bg-[#FEF2F2] px-4 py-2.5 text-xs font-medium text-[#991B1B]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{popValidation.error}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8CFBE] bg-white px-4 py-2.5 text-sm font-semibold text-[#10233F] hover:bg-[#F5F0E6]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              disabled={!popValidation.valid}
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#10233F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#19335A] disabled:opacity-50"
            >
              Next: Simulation Settings
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 & STEP 5: SETTINGS & RUN */}
      {(currentStep === 4 || currentStep === 5) && activeSim && activeMatrix && (
        <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-6 shadow-[0_2px_10px_rgba(16,35,63,0.05)] space-y-6">
          <div>
            <h2 className="font-heading text-lg font-semibold text-[#10233F]">
              {currentStep === 4
                ? 'Step 4 – Simulation Settings'
                : 'Step 5 – Review & Run Simulation'}
            </h2>
            <p className="text-xs text-[#5C574E]">
              Configure the number of time steps and execute iterative matrix multiplication v(k+1) = P &times; v(k).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl border border-[#E5DEC9] bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="iterations-input" className="text-xs font-semibold text-[#10233F]">
                  Time Periods / Iterations (k = 0 to {iterations})
                </label>
                <span className="font-mono-tabular text-sm font-bold text-[#10233F]">{iterations}</span>
              </div>
              <input
                type="range"
                min={1}
                max={60}
                value={Math.min(60, iterations)}
                onChange={(e) => setIterations(Number(e.target.value))}
                className="w-full accent-[#F5A623]"
              />
              <div className="flex items-center gap-2">
                <input
                  id="iterations-input"
                  type="number"
                  min={1}
                  max={500}
                  value={iterations}
                  onChange={(e) => setIterations(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                  className="w-28 rounded-lg border border-[#D8CFBE] px-3 py-1.5 font-mono-tabular text-sm"
                />
                <span className="text-xs text-[#6B655B]">Enter 1 to 500 periods</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#E5DEC9] bg-white p-4 space-y-3">
              <label htmlFor="unit-label-select" className="block text-xs font-semibold text-[#10233F]">
                Time Period Label
              </label>
              <select
                id="unit-label-select"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                className="w-full rounded-lg border border-[#D8CFBE] bg-white px-3 py-2 text-sm text-[#10233F]"
              >
                <option value="Step">Step (Step 0, Step 1, ...)</option>
                <option value="Year">Year (Year 0, Year 1, ...)</option>
                <option value="Month">Month (Month 0, Month 1, ...)</option>
                <option value="Quarter">Quarter (Quarter 0, Quarter 1, ...)</option>
              </select>
              <p className="text-[11px] text-[#6B655B]">
                Model: <strong>{activeSim.name}</strong> &middot; Matrix: <strong>{activeMatrix.matrix_name}</strong>
              </p>
            </div>
          </div>

          {/* Pre-flight Summary */}
          <div className="rounded-xl border border-[#E5DEC9] bg-[#FAF6ED] p-4 text-xs text-[#292724] grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="font-semibold text-[#10233F]">Initial Mode:</span>{' '}
              {popMode === 'probability' ? 'Probability Vector (Σ = 1)' : `Population Counts (N = ${popValidation.total.toLocaleString()})`}
            </div>
            <div>
              <span className="font-semibold text-[#10233F]">States:</span> {activeSim.states.length}
            </div>
            <div>
              <span className="font-semibold text-[#10233F]">Horizon:</span> {iterations} {unitLabel}(s)
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8CFBE] bg-white px-4 py-2.5 text-sm font-semibold text-[#10233F] hover:bg-[#F5F0E6]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="flex items-center gap-3">
              {currentStep === 4 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#10233F] bg-white px-4 py-2.5 text-sm font-semibold text-[#10233F] hover:bg-[#F5F0E6]"
                >
                  Review Step 5
                </button>
              )}
              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={running}
                className="inline-flex items-center gap-2 rounded-lg bg-[#F5A623] px-6 py-2.5 text-sm font-bold text-[#10233F] hover:bg-[#E59716] shadow-xs disabled:opacity-60"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                <span>{running ? 'Computing v(k+1) = P × v(k)...' : 'Run Simulation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6 & STEP 7: RESULTS & SAVE */}
      {(currentStep === 6 || currentStep === 7) && results && activeSim && activeMatrix && (
        <div className="space-y-6">
          {/* Save Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-4 shadow-[0_2px_8px_rgba(16,35,63,0.04)]">
            <div className="text-sm">
              <span className="font-heading font-semibold text-[#10233F]">
                Step {savedRunId ? '7' : '6'} &ndash; {activeSim.name}
              </span>
              <span className="mx-2 text-[#B8AF9C]">|</span>
              <span className="text-xs text-[#5C574E]">
                Matrix: {activeMatrix.matrix_name} &middot; {iterations} {unitLabel}(s) &middot;{' '}
                {results.mode === 'probability' ? 'Probability Distribution' : 'Population Counts'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {results.mode === 'counts' && (
                <div className="inline-flex rounded-lg bg-[#F5F0E6] p-0.5 border border-[#E5DEC9]">
                  <button
                    type="button"
                    onClick={() => setChartDisplayMode('native')}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                      chartDisplayMode === 'native' ? 'bg-[#10233F] text-white' : 'text-[#4A463F]'
                    }`}
                  >
                    Population Counts
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartDisplayMode('share')}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                      chartDisplayMode === 'share' ? 'bg-[#10233F] text-white' : 'text-[#4A463F]'
                    }`}
                  >
                    Probability Share
                  </button>
                </div>
              )}

              {savedRunId ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#BBDFCC] bg-[#EAF7F0] px-3.5 py-2 text-xs font-semibold text-[#14532D]">
                  <CheckCircle2 className="h-4 w-4" />
                  Saved in SQLite (Run #{savedRunId})
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveRun}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#10233F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#19335A] disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{saving ? 'Saving...' : 'Step 7: Save Results to SQLite'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Initial vs Final Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_8px_rgba(16,35,63,0.04)] space-y-4">
              <h3 className="font-heading text-sm font-semibold text-[#10233F]">
                Initial vs. Final Predicted Distribution
              </h3>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E5DEC9] text-[#5C574E]">
                    <th className="py-2 text-left font-semibold">State</th>
                    <th className="py-2 text-right font-semibold">{unitLabel} 0</th>
                    <th className="py-2 text-right font-semibold">{unitLabel} {iterations}</th>
                    <th className="py-2 text-right font-semibold">Net Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0E9DA]">
                  {activeSim.states.map((st, idx) => {
                    const initVal = results.trajectory[0][idx];
                    const finalVal = results.finalDistribution[idx];
                    const net = finalVal - initVal;
                    return (
                      <tr key={idx}>
                        <td className="py-2.5 font-medium text-[#10233F]">{st}</td>
                        <td className="py-2.5 text-right font-mono-tabular">
                          {formatNumberValue(initVal, results.mode)}
                        </td>
                        <td className="py-2.5 text-right font-mono-tabular font-semibold text-[#10233F]">
                          {formatNumberValue(finalVal, results.mode)}
                        </td>
                        <td
                          className={`py-2.5 text-right font-mono-tabular font-semibold ${
                            net >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                          }`}
                        >
                          {net >= 0 ? '+' : ''}
                          {formatNumberValue(net, results.mode)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="pt-2 border-t border-[#EFE9DA]">
                <div className="text-xs font-semibold text-[#10233F] mb-2">
                  Transition Matrix P ({activeMatrix.matrix_name})
                </div>
                <div className="overflow-x-auto rounded-lg bg-[#FAF6ED] p-2 border border-[#EFE9DA]">
                  <table className="w-full text-center font-mono-tabular text-[11px]">
                    <tbody>
                      {activeMatrix.matrix_data.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((val, ci) => (
                            <td key={ci} className="px-2 py-1">
                              {val.toFixed(4)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Interactive Plotly Trajectory Chart */}
            <div className="lg:col-span-7 rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_8px_rgba(16,35,63,0.04)]">
              <h3 className="font-heading text-sm font-semibold text-[#10233F]">
                Population Trajectory Across Time Periods
              </h3>
              <PlotlyChart
                data={lineTraces}
                height={300}
                layout={{
                  yaxis: {
                    title: {
                      text:
                        results.mode === 'probability' || chartDisplayMode === 'share'
                          ? 'Probability Share'
                          : 'Population Count',
                      font: { size: 11 },
                    },
                    range:
                      results.mode === 'probability' || chartDisplayMode === 'share'
                        ? [0, 1.05]
                        : undefined,
                  },
                }}
              />
            </div>
          </div>

          {/* Comparison Bar Chart */}
          <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_8px_rgba(16,35,63,0.04)]">
            <h3 className="font-heading text-sm font-semibold text-[#10233F]">
              Initial vs. Predicted Population Comparison
            </h3>
            <PlotlyChart
              data={comparisonBarTraces}
              height={280}
              layout={{
                barmode: 'group',
                yaxis: {
                  title: {
                    text:
                      results.mode === 'probability' || chartDisplayMode === 'share'
                        ? 'Probability Share'
                        : 'Population Count',
                    font: { size: 11 },
                  },
                },
              }}
            />
          </div>

          {/* Step-by-Step Results & Period Changes Table */}
          <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_8px_rgba(16,35,63,0.04)] space-y-3">
            <h3 className="font-heading text-sm font-semibold text-[#10233F]">
              Complete Period-by-Period Distribution &amp; Step Changes (&Delta;v)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E5DEC9] bg-[#F6F1E7] text-[#10233F]">
                    <th className="py-2.5 px-3 text-left font-semibold">{unitLabel}</th>
                    {activeSim.states.map((st, idx) => (
                      <th key={idx} className="py-2.5 px-3 text-right font-semibold">
                        {st}
                      </th>
                    ))}
                    {activeSim.states.map((st, idx) => (
                      <th key={`d-${idx}`} className="py-2.5 px-3 text-right font-semibold text-[#4D83A8]">
                        &Delta; {st}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE9DA]">
                  {results.trajectory.map((stepVec, stepIdx) => {
                    const deltaVec = stepIdx > 0 ? results.deltas[stepIdx - 1] : null;
                    return (
                      <tr key={stepIdx} className="hover:bg-[#FAF6ED]">
                        <td className="py-2 px-3 font-semibold text-[#10233F] whitespace-nowrap">
                          {unitLabel} {stepIdx}
                        </td>
                        {stepVec.map((val, sIdx) => (
                          <td key={sIdx} className="py-2 px-3 text-right font-mono-tabular">
                            {formatNumberValue(val, results.mode)}
                          </td>
                        ))}
                        {activeSim.states.map((_, sIdx) => {
                          const d = deltaVec ? deltaVec[sIdx] : 0;
                          return (
                            <td
                              key={`dv-${sIdx}`}
                              className={`py-2 px-3 text-right font-mono-tabular ${
                                stepIdx === 0
                                  ? 'text-[#9E9480]'
                                  : d >= 0
                                    ? 'text-[#15803D]'
                                    : 'text-[#B91C1C]'
                              }`}
                            >
                              {stepIdx === 0
                                ? '—'
                                : `${d >= 0 ? '+' : ''}${formatNumberValue(d, results.mode)}`}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
