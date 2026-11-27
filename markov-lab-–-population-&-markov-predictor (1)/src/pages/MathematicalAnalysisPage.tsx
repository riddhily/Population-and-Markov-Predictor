import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  GitCompare,
  Layers,
  Sigma,
} from 'lucide-react';
import type { Data } from 'plotly.js-dist-min';
import { useEffect, useMemo, useState } from 'react';
import { CHART_PALETTE, PlotlyChart } from '../components/PlotlyChart';
import {
  analyzeDiagonalization,
  analyzeEigenvalues,
  analyzeSteadyState,
  formatComplex,
  runMarkovSimulation,
} from '../lib/markovMath';
import type { PageId, Simulation, SimulationRun, TransitionMatrix } from '../types';

interface MathematicalAnalysisPageProps {
  simulations: Simulation[];
  matrices: TransitionMatrix[];
  runs: SimulationRun[];
  onNavigate: (page: PageId) => void;
}

type AnalysisTab = 'eigenvalues' | 'steady-state' | 'diagonalization' | 'comparison';

export function MathematicalAnalysisPage({
  simulations,
  matrices,
  runs,
  onNavigate,
}: MathematicalAnalysisPageProps) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('eigenvalues');
  const [selectedSimId, setSelectedSimId] = useState<number | ''>(simulations[0]?.id ?? '');
  const [selectedMatrixId, setSelectedMatrixId] = useState<number | ''>('');
  const [selectedRunIds, setSelectedRunIds] = useState<number[]>([]);
  const [compareMatrixIds, setCompareMatrixIds] = useState<number[]>([]);
  const [compareSteps, setCompareSteps] = useState<number>(12);

  useEffect(() => {
    if (!selectedSimId && simulations.length > 0) {
      setSelectedSimId(simulations[0].id);
    }
  }, [simulations, selectedSimId]);

  const activeSim = useMemo(
    () => simulations.find((s) => s.id === Number(selectedSimId)) ?? null,
    [simulations, selectedSimId]
  );

  const simMatrices = useMemo(
    () => matrices.filter((m) => m.simulation_id === activeSim?.id),
    [matrices, activeSim]
  );

  const simRuns = useMemo(
    () => runs.filter((r) => r.simulation_id === activeSim?.id),
    [runs, activeSim]
  );

  useEffect(() => {
    if (!activeSim) return;
    if (!simMatrices.some((m) => m.id === Number(selectedMatrixId))) {
      setSelectedMatrixId(simMatrices[0]?.id ?? '');
    }
    setCompareMatrixIds(simMatrices.slice(0, 3).map((m) => m.id));
    setSelectedRunIds(simRuns.slice(0, 3).map((r) => r.id));
  }, [activeSim?.id, simMatrices.length, simRuns.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeMatrix = useMemo(
    () => simMatrices.find((m) => m.id === Number(selectedMatrixId)) ?? null,
    [simMatrices, selectedMatrixId]
  );

  const eigenResult = useMemo(
    () => (activeMatrix ? analyzeEigenvalues(activeMatrix.matrix_data) : null),
    [activeMatrix]
  );

  const steadyResult = useMemo(
    () => (activeMatrix ? analyzeSteadyState(activeMatrix.matrix_data) : null),
    [activeMatrix]
  );

  const diagResult = useMemo(
    () => (activeMatrix ? analyzeDiagonalization(activeMatrix.matrix_data) : null),
    [activeMatrix]
  );

  // Unit Circle Plotly Data
  const unitCircleData: Data[] = useMemo(() => {
    if (!eigenResult) return [];
    const theta = Array.from({ length: 121 }, (_, k) => (k / 120) * 2 * Math.PI);
    return [
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Unit Circle |λ| = 1',
        x: theta.map((t) => Math.cos(t)),
        y: theta.map((t) => Math.sin(t)),
        line: { color: '#C8BFA9', dash: 'dot', width: 1.5 },
        hoverinfo: 'skip',
      },
      {
        type: 'scatter',
        mode: 'text+markers',
        name: 'Eigenvalues λ',
        x: eigenResult.pairs.map((p) => p.eigenvalue.re),
        y: eigenResult.pairs.map((p) => p.eigenvalue.im),
        text: eigenResult.pairs.map((_, idx) => `λ${idx + 1}`),
        textposition: 'top center',
        marker: {
          size: 11,
          color: eigenResult.pairs.map((p) =>
            Math.abs(p.modulus - 1) < 1e-4 ? '#F5A623' : '#10233F'
          ),
          line: { color: '#FFFCF6', width: 1.5 },
        },
        hovertemplate: '<b>%{text}</b><br>Re: %{x:.4f}<br>Im: %{y:.4f}<extra></extra>',
      },
    ];
  }, [eigenResult]);

  // Steady-State Convergence Curve
  const convergenceData: Data[] = useMemo(() => {
    if (!activeMatrix || !activeSim || !steadyResult?.stationaryVector) return [];
    const n = activeSim.states.length;
    const v0 = Array(n).fill(0);
    v0[0] = 1; // Worst-case start concentrated in State 1
    const sim = runMarkovSimulation(activeMatrix.matrix_data, v0, 25, 'probability');
    return activeSim.states.map((st, idx) => ({
      type: 'scatter',
      mode: 'lines+markers',
      name: st,
      x: sim.trajectory.map((_, k) => k),
      y: sim.trajectory.map((vec) => vec[idx]),
      line: { color: CHART_PALETTE[idx % CHART_PALETTE.length], width: 2.2 },
      marker: { size: 5 },
    }));
  }, [activeMatrix, activeSim, steadyResult]);

  // Steady-State Bar Chart
  const steadyBarData: Data[] = useMemo(() => {
    if (!activeSim || !steadyResult?.stationaryVector) return [];
    return [
      {
        type: 'bar',
        name: 'Steady-State π',
        x: activeSim.states,
        y: steadyResult.stationaryVector,
        marker: {
          color: activeSim.states.map((_, idx) => CHART_PALETTE[idx % CHART_PALETTE.length]),
        },
        text: steadyResult.stationaryVector.map((v) => `${(v * 100).toFixed(2)}%`),
        textposition: 'auto',
      },
    ];
  }, [activeSim, steadyResult]);

  // Multi-Run Comparison Traces (State 1 trajectory or all states side by side)
  const multiRunTraces: Data[] = useMemo(() => {
    if (!activeSim) return [];
    const chosen = runs.filter((r) => selectedRunIds.includes(r.id));
    const traces: Data[] = [];
    chosen.forEach((run, rIdx) => {
      const dashStyles: ('solid' | 'dash' | 'dot')[] = ['solid', 'dash', 'dot'];
      const dash = dashStyles[rIdx % dashStyles.length];
      run.states.forEach((st, sIdx) => {
        traces.push({
          type: 'scatter',
          mode: 'lines',
          name: `Run #${run.id} (${run.matrix_name}) – ${st}`,
          x: run.results.normalizedTrajectory.map((_, k) => `Step ${k}`),
          y: run.results.normalizedTrajectory.map((v) => v[sIdx] ?? 0),
          line: {
            color: CHART_PALETTE[sIdx % CHART_PALETTE.length],
            dash,
            width: 2.2,
          },
        });
      });
    });
    return traces;
  }, [runs, selectedRunIds, activeSim]);

  // Matrix-vs-Matrix Steady-State Comparison
  const matrixCompareBars: Data[] = useMemo(() => {
    if (!activeSim) return [];
    const chosenMats = simMatrices.filter((m) => compareMatrixIds.includes(m.id));
    return chosenMats.map((mat, idx) => {
      const n = activeSim.states.length;
      const v0 = Array(n).fill(1 / n);
      const proj = runMarkovSimulation(mat.matrix_data, v0, compareSteps, 'probability');
      return {
        type: 'bar',
        name: mat.matrix_name,
        x: activeSim.states,
        y: proj.finalDistribution,
        marker: { color: CHART_PALETTE[idx % CHART_PALETTE.length] },
      };
    });
  }, [activeSim, simMatrices, compareMatrixIds, compareSteps]);

  const matrixCompareSummary = useMemo(() => {
    return simMatrices
      .filter((m) => compareMatrixIds.includes(m.id))
      .map((mat) => ({
        matrix: mat,
        eigen: analyzeEigenvalues(mat.matrix_data),
        steady: analyzeSteadyState(mat.matrix_data),
      }));
  }, [simMatrices, compareMatrixIds]);

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-3xl font-bold text-[#10233F]">
            Mathematical Analysis
          </h1>
          <p className="mt-1 text-sm text-[#4A463F]">
            Inspect eigenvalues, eigenvectors, steady-state convergence, diagonalisation, and multi-run comparisons.
          </p>
        </div>

        {simulations.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="analysis-sim" className="text-xs font-semibold text-[#10233F]">
                Model:
              </label>
              <select
                id="analysis-sim"
                value={selectedSimId}
                onChange={(e) => setSelectedSimId(Number(e.target.value))}
                className="rounded-lg border border-[#D8CFBE] bg-[#FFFCF6] px-3 py-2 text-xs font-semibold text-[#10233F]"
              >
                {simulations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {simMatrices.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="analysis-mat" className="text-xs font-semibold text-[#10233F]">
                  Matrix:
                </label>
                <select
                  id="analysis-mat"
                  value={selectedMatrixId}
                  onChange={(e) => setSelectedMatrixId(Number(e.target.value))}
                  className="rounded-lg border border-[#D8CFBE] bg-[#FFFCF6] px-3 py-2 text-xs font-semibold text-[#10233F]"
                >
                  {simMatrices.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.matrix_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-1.5 shadow-xs">
        {[
          { id: 'eigenvalues', label: 'Eigenvalue Analysis', icon: Sigma },
          { id: 'steady-state', label: 'Steady-State Analysis', icon: Activity },
          { id: 'diagonalization', label: 'Diagonalisation', icon: Layers },
          { id: 'comparison', label: 'Visualisation & Comparison', icon: GitCompare },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AnalysisTab)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#10233F] text-white'
                  : 'text-[#4A463F] hover:bg-[#F5F0E6] hover:text-[#10233F]'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? 'text-[#F5A623]' : 'text-[#4D83A8]'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Empty States */}
      {simulations.length === 0 || !activeMatrix ? (
        <div className="rounded-xl border border-dashed border-[#D8CFBE] bg-[#FFFCF6] p-10 text-center space-y-3">
          <BarChart3 className="mx-auto h-9 w-9 text-[#4D83A8]/70" />
          <p className="font-heading text-base font-semibold text-[#10233F]">
            {simulations.length === 0
              ? 'No Simulations Available for Analysis'
              : `No Transition Matrices Saved for "${activeSim?.name}"`}
          </p>
          <p className="mx-auto max-w-md text-xs text-[#5C574E]">
            Build and save at least one valid transition matrix in SQLite to compute eigenvalues,
            eigenvectors, steady-state distributions, and diagonalisation.
          </p>
          <button
            type="button"
            onClick={() => onNavigate(simulations.length === 0 ? 'simulation-manager' : 'matrix-builder')}
            className="rounded-lg bg-[#10233F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#19335A]"
          >
            {simulations.length === 0 ? 'Create Simulation' : 'Open Matrix Builder'}
          </button>
        </div>
      ) : (
        <>
          {/* TAB 1: EIGENVALUE ANALYSIS */}
          {activeTab === 'eigenvalues' && eigenResult && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left: Eigenvalues & Eigenvectors Table */}
                <div className="lg:col-span-7 rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_10px_rgba(16,35,63,0.05)] space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-heading text-base font-semibold text-[#10233F]">
                      Eigenvalues &amp; Eigenvectors of P
                    </h2>
                    <span className="text-xs font-medium text-[#4D83A8] tabular-nums">
                      Spectral Gap: {eigenResult.spectralGap !== null ? eigenResult.spectralGap.toFixed(4) : '0.0000'}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#E5DEC9] bg-[#F6F1E7] text-[#10233F]">
                          <th className="py-2.5 px-3 text-left font-semibold">Index</th>
                          <th className="py-2.5 px-3 text-left font-semibold">Eigenvalue (&lambda;)</th>
                          <th className="py-2.5 px-3 text-right font-semibold">Modulus |&lambda;|</th>
                          <th className="py-2.5 px-3 text-left font-semibold">Corresponding Eigenvector</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFE9DA]">
                        {eigenResult.pairs.map((pair, idx) => (
                          <tr key={idx} className="hover:bg-[#FAF6ED]">
                            <td className="py-2.5 px-3 font-semibold text-[#10233F]">
                              &lambda;<sub>{idx + 1}</sub>
                            </td>
                            <td className="py-2.5 px-3 font-mono-tabular font-semibold text-[#10233F] whitespace-nowrap">
                              {formatComplex(pair.eigenvalue, 4)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular">
                              {pair.modulus.toFixed(4)}
                            </td>
                            <td className="py-2.5 px-3 font-mono-tabular text-[11px] text-[#4A463F]">
                              [{pair.eigenvector.map((c) => formatComplex(c, 3)).join(', ')}]&#7488;
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-lg border border-[#E5DEC9] bg-[#F5F0E6]/65 p-4 space-y-2 text-xs text-[#292724]">
                    <div className="font-semibold text-[#10233F]">What These Results Mean:</div>
                    <ul className="list-disc pl-5 space-y-1 leading-relaxed text-[#4A463F]">
                      {eigenResult.interpretation.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right: Complex Plane Unit Circle Plot */}
                <div className="lg:col-span-5 rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_10px_rgba(16,35,63,0.05)]">
                  <h2 className="font-heading text-base font-semibold text-[#10233F]">
                    Spectrum on Complex Unit Circle
                  </h2>
                  <p className="mt-0.5 text-xs text-[#6B655B]">
                    All eigenvalues of a stochastic matrix lie inside or on |&lambda;| = 1.
                  </p>
                  <PlotlyChart
                    data={unitCircleData}
                    height={310}
                    layout={{
                      margin: { l: 44, r: 20, t: 28, b: 42 },
                      xaxis: {
                        title: { text: 'Real Part Re(λ)', font: { size: 11 } },
                        range: [-1.25, 1.25],
                        zeroline: true,
                      },
                      yaxis: {
                        title: { text: 'Imaginary Part Im(λ)', font: { size: 11 } },
                        range: [-1.25, 1.25],
                        scaleanchor: 'x',
                        scaleratio: 1,
                        zeroline: true,
                      },
                      showlegend: false,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STEADY-STATE ANALYSIS */}
          {activeTab === 'steady-state' && steadyResult && activeSim && (
            <div className="space-y-5">
              {/* Status Card */}
              <div
                className={`rounded-xl border p-5 flex items-start gap-3.5 ${
                  steadyResult.isErgodic
                    ? 'border-[#BBDFCC] bg-[#EAF7F0] text-[#14532D]'
                    : 'border-[#F3DFB6] bg-[#FFF8EB] text-[#7C4A03]'
                }`}
              >
                {steadyResult.isErgodic ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 text-sm">
                  <div className="font-heading font-semibold">{steadyResult.statusLabel}</div>
                  <p className="text-xs leading-relaxed opacity-90">{steadyResult.explanation}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left: Steady-State Vector & Numerical Validation */}
                <div className="lg:col-span-5 rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_10px_rgba(16,35,63,0.05)] space-y-4">
                  <h2 className="font-heading text-base font-semibold text-[#10233F]">
                    Stationary Distribution &pi; (P&pi; = &pi;)
                  </h2>

                  {steadyResult.stationaryVector ? (
                    <>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#E5DEC9] bg-[#F6F1E7] text-[#10233F]">
                            <th className="py-2 px-3 text-left font-semibold">State</th>
                            <th className="py-2 px-3 text-right font-semibold">Steady Share (&pi;)</th>
                            <th className="py-2 px-3 text-right font-semibold">Percentage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EFE9DA]">
                          {activeSim.states.map((st, idx) => {
                            const val = steadyResult.stationaryVector![idx];
                            return (
                              <tr key={idx}>
                                <td className="py-2.5 px-3 font-medium text-[#10233F]">{st}</td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold">
                                  {val.toFixed(6)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular text-[#4D83A8] font-semibold">
                                  {(val * 100).toFixed(2)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div className="rounded-lg border border-[#E5DEC9] bg-[#FAF6ED] p-3.5 text-xs space-y-1.5">
                        <div className="font-semibold text-[#10233F]">Numerical Validation Checks</div>
                        <div className="flex justify-between">
                          <span className="text-[#5C574E]">Residual ||P&pi; &minus; &pi;||&infin;:</span>
                          <span className="font-mono-tabular font-semibold text-[#15803D]">
                            {steadyResult.residualNorm?.toExponential(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#5C574E]">Probability Sum (&Sigma;&pi;&#7522;):</span>
                          <span className="font-mono-tabular font-semibold text-[#10233F]">
                            {steadyResult.sumCheck?.toFixed(6)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#5C574E]">Nullity of (P &minus; I):</span>
                          <span className="font-mono-tabular font-semibold text-[#10233F]">
                            {steadyResult.nullity}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-[#4A463F]">
                        Basis vectors for the invariant subspace (P &minus; I)v = 0 (dimension {steadyResult.nullity}):
                      </p>
                      {steadyResult.basisVectors.map((vec, bIdx) => (
                        <div
                          key={bIdx}
                          className="rounded-lg border border-[#E5DEC9] bg-[#FAF6ED] p-3 font-mono-tabular text-xs text-[#10233F]"
                        >
                          &pi;<sup>({bIdx + 1})</sup> = [{vec.map((x) => x.toFixed(4)).join(', ')}]&#7488;
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Bar + Convergence Plots */}
                <div className="lg:col-span-7 space-y-5">
                  {steadyResult.stationaryVector ? (
                    <>
                      <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_10px_rgba(16,35,63,0.05)]">
                        <h3 className="font-heading text-sm font-semibold text-[#10233F]">
                          Long-Run Equilibrium Shares (&pi;)
                        </h3>
                        <PlotlyChart
                          data={steadyBarData}
                          height={220}
                          layout={{
                            showlegend: false,
                            yaxis: { range: [0, 1.05], title: { text: 'Share', font: { size: 11 } } },
                          }}
                        />
                      </div>

                      <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_10px_rgba(16,35,63,0.05)]">
                        <h3 className="font-heading text-sm font-semibold text-[#10233F]">
                          Convergence Simulation (From 100% in {activeSim.states[0]})
                        </h3>
                        <PlotlyChart
                          data={convergenceData}
                          height={230}
                          layout={{
                            xaxis: { title: { text: 'Iteration k', font: { size: 11 } } },
                            yaxis: { range: [0, 1.05], title: { text: 'Share', font: { size: 11 } } },
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-8 text-center text-xs text-[#5C574E]">
                      Because this chain does not have a single unique equilibrium distribution, a single
                      steady-state bar chart is omitted. Use the <strong>Markov Simulator</strong> to
                      inspect how different starting vectors v(0) evolve.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIAGONALISATION */}
          {activeTab === 'diagonalization' && diagResult && (
            <div className="space-y-5">
              <div
                className={`rounded-xl border p-5 flex items-start gap-3.5 ${
                  diagResult.isDiagonalizable
                    ? 'border-[#BBDFCC] bg-[#EAF7F0] text-[#14532D]'
                    : 'border-[#F5C2C2] bg-[#FEF2F2] text-[#991B1B]'
                }`}
              >
                {diagResult.isDiagonalizable ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 text-sm">
                  <div className="font-heading font-semibold">
                    {diagResult.isDiagonalizable
                      ? `Matrix is Diagonalizable (${diagResult.independentEigenvectors}/${diagResult.matrixSize} Independent Eigenvectors)`
                      : `Matrix is Not Diagonalizable (${diagResult.independentEigenvectors}/${diagResult.matrixSize} Independent Eigenvectors)`}
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">{diagResult.explanation}</p>
                </div>
              </div>

              {diagResult.isDiagonalizable && diagResult.V && diagResult.D && diagResult.VInv && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {[
                      { title: 'Eigenvector Matrix V', mat: diagResult.V },
                      { title: 'Diagonal Eigenvalue Matrix D', mat: diagResult.D },
                      { title: 'Inverse Matrix V⁻¹', mat: diagResult.VInv },
                    ].map((block) => (
                      <div
                        key={block.title}
                        className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-4 shadow-[0_2px_8px_rgba(16,35,63,0.04)]"
                      >
                        <h3 className="font-heading text-xs font-semibold text-[#10233F] mb-2.5">
                          {block.title}
                        </h3>
                        <div className="overflow-x-auto rounded-lg border border-[#EFE9DA] bg-[#FAF6ED] p-2">
                          <table className="w-full text-center font-mono-tabular text-[11px] text-[#10233F]">
                            <tbody>
                              {block.mat.map((row, ri) => (
                                <tr key={ri}>
                                  {row.map((c, ci) => (
                                    <td key={ci} className="px-1.5 py-1 whitespace-nowrap">
                                      {formatComplex(c, 3)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-4 text-xs text-[#4A463F] flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Closed-form power formula:{' '}
                      <strong className="font-serif-display italic text-[#10233F]">
                        P&#7503; = V &middot; D&#7503; &middot; V&#8315;&sup1;
                      </strong>
                    </span>
                    <span className="font-mono-tabular font-semibold text-[#15803D]">
                      Max Reconstruction Error ||V D V&#8315;&sup1; &minus; P||&infin; ={' '}
                      {diagResult.reconstructionError?.toExponential(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: VISUALISATION & COMPARISON */}
          {activeTab === 'comparison' && activeSim && (
            <div className="space-y-6">
              {/* Section A: Compare Multiple Simulation Runs */}
              <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_10px_rgba(16,35,63,0.05)] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-base font-semibold text-[#10233F]">
                      Compare Saved Simulation Runs ({activeSim.name})
                    </h2>
                    <p className="text-xs text-[#5C574E]">
                      Select two or more saved runs from SQLite to overlay their population share trajectories.
                    </p>
                  </div>
                </div>

                {simRuns.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#D8CFBE] p-6 text-center text-xs text-[#6B655B]">
                    No saved simulation runs exist for {activeSim.name} yet. Save runs in the Markov
                    Simulator to compare them here.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {simRuns.map((run) => {
                        const checked = selectedRunIds.includes(run.id);
                        return (
                          <button
                            key={run.id}
                            type="button"
                            onClick={() =>
                              setSelectedRunIds((prev) =>
                                prev.includes(run.id)
                                  ? prev.filter((id) => id !== run.id)
                                  : [...prev, run.id]
                              )
                            }
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              checked
                                ? 'border-[#10233F] bg-[#10233F] text-white'
                                : 'border-[#D8CFBE] bg-white text-[#292724] hover:bg-[#F5F0E6]'
                            }`}
                          >
                            Run #{run.id} &middot; {run.matrix_name} ({run.iterations} steps)
                          </button>
                        );
                      })}
                    </div>

                    {selectedRunIds.length > 0 ? (
                      <PlotlyChart
                        data={multiRunTraces}
                        height={320}
                        layout={{
                          yaxis: { range: [0, 1.05], title: { text: 'Population Share', font: { size: 11 } } },
                        }}
                      />
                    ) : (
                      <p className="text-xs text-[#6B655B]">Select at least one run above to display comparison chart.</p>
                    )}
                  </>
                )}
              </div>

              {/* Section B: Compare Different Transition Matrices */}
              <div className="rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_10px_rgba(16,35,63,0.05)] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-base font-semibold text-[#10233F]">
                      Compare Transition Matrices ({activeSim.name})
                    </h2>
                    <p className="text-xs text-[#5C574E]">
                      Compare predicted distributions from a uniform starting state after {compareSteps} steps, along with spectral gaps.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="cmp-steps" className="text-xs font-semibold text-[#10233F]">
                      Horizon:
                    </label>
                    <input
                      id="cmp-steps"
                      type="number"
                      min={1}
                      max={100}
                      value={compareSteps}
                      onChange={(e) => setCompareSteps(Math.max(1, Math.min(100, Number(e.target.value) || 10)))}
                      className="w-20 rounded-lg border border-[#D8CFBE] px-2.5 py-1 font-mono-tabular text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {simMatrices.map((mat) => {
                    const checked = compareMatrixIds.includes(mat.id);
                    return (
                      <button
                        key={mat.id}
                        type="button"
                        onClick={() =>
                          setCompareMatrixIds((prev) =>
                            prev.includes(mat.id)
                              ? prev.filter((id) => id !== mat.id)
                              : [...prev, mat.id]
                          )
                        }
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          checked
                            ? 'border-[#F5A623] bg-[#F5A623] text-[#10233F] font-semibold'
                            : 'border-[#D8CFBE] bg-white text-[#292724] hover:bg-[#F5F0E6]'
                        }`}
                      >
                        {mat.matrix_name}
                      </button>
                    );
                  })}
                </div>

                {compareMatrixIds.length > 0 && (
                  <>
                    <PlotlyChart
                      data={matrixCompareBars}
                      height={270}
                      layout={{
                        barmode: 'group',
                        yaxis: {
                          range: [0, 1.05],
                          title: { text: `Projected Share at Step ${compareSteps}`, font: { size: 11 } },
                        },
                      }}
                    />

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#E5DEC9] bg-[#F6F1E7] text-[#10233F]">
                            <th className="py-2 px-3 text-left font-semibold">Matrix</th>
                            <th className="py-2 px-3 text-left font-semibold">Type</th>
                            <th className="py-2 px-3 text-right font-semibold">Subdominant |&lambda;<sub>2</sub>|</th>
                            <th className="py-2 px-3 text-right font-semibold">Spectral Gap</th>
                            <th className="py-2 px-3 text-left font-semibold">Steady-State Behaviour</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EFE9DA]">
                          {matrixCompareSummary.map(({ matrix, eigen, steady }) => (
                            <tr key={matrix.id}>
                              <td className="py-2.5 px-3 font-semibold text-[#10233F]">
                                {matrix.matrix_name}
                              </td>
                              <td className="py-2.5 px-3 capitalize text-[#5C574E]">
                                {matrix.generation_type}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular">
                                {eigen.secondModulus !== null ? eigen.secondModulus.toFixed(4) : '1.0000'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular">
                                {eigen.spectralGap !== null ? eigen.spectralGap.toFixed(4) : '0.0000'}
                              </td>
                              <td className="py-2.5 px-3 text-[#4A463F]">
                                {steady.statusLabel}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
