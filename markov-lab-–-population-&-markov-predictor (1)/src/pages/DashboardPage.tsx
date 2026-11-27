import {
  ArrowRight,
  BarChart2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FlaskConical,
  Grid3X3,
  Play,
  Plus,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { Data } from 'plotly.js-dist-min';
import { useState } from 'react';
import { CHART_PALETTE, PlotlyChart } from '../components/PlotlyChart';
import { formatDisplayDateTime, formatRelativeActivityDate } from '../lib/formatters';
import type { DashboardData, PageId, SimulationRun } from '../types';

interface DashboardPageProps {
  data: DashboardData | null;
  loading: boolean;
  onNavigate: (page: PageId) => void;
  onOpenRun: (run: SimulationRun) => void;
  onLoadExample: () => Promise<void>;
}

function HeroMathIllustration() {
  return (
    <svg
      viewBox="0 0 340 130"
      className="hidden md:block w-[290px] lg:w-[340px] h-[115px] shrink-0 select-none"
      fill="none"
      aria-hidden="true"
    >
      {/* Subtle Markov Network Background */}
      <g opacity="0.22" stroke="#C69C4D" strokeWidth="1.2">
        <line x1="25" y1="30" x2="90" y2="20" />
        <line x1="90" y1="20" x2="155" y2="48" />
        <line x1="90" y1="20" x2="112" y2="82" />
        <line x1="25" y1="30" x2="55" y2="85" />
        <line x1="155" y1="48" x2="215" y2="22" />
        <line x1="215" y1="22" x2="295" y2="55" />
        <line x1="295" y1="55" x2="328" y2="85" />
        <circle cx="25" cy="30" r="3.5" fill="#F5A623" />
        <circle cx="90" cy="20" r="4" fill="#4D83A8" />
        <circle cx="155" cy="48" r="3.5" fill="#F5A623" />
        <circle cx="215" cy="22" r="3.5" fill="#4D83A8" />
        <circle cx="295" cy="55" r="3.5" fill="#F5A623" />
      </g>

      {/* Distribution Curve */}
      <line x1="40" y1="108" x2="330" y2="108" stroke="#10233F" strokeWidth="1.5" />
      <path
        d="M55 108 C115 108, 152 24, 195 24 C238 24, 272 108, 326 108"
        stroke="#10233F"
        strokeWidth="2"
        fill="url(#curveFill)"
      />
      <defs>
        <linearGradient id="curveFill" x1="195" y1="24" x2="195" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4D83A8" stopOpacity="0.18" />
          <stop offset="1" stopColor="#4D83A8" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Vertical Projections */}
      <line x1="152" y1="53" x2="152" y2="108" stroke="#4D83A8" strokeWidth="1.4" />
      <line x1="195" y1="24" x2="195" y2="108" stroke="#10233F" strokeWidth="1.6" />
      <line x1="238" y1="53" x2="238" y2="108" stroke="#4D83A8" strokeWidth="1.4" />

      {/* Highlight Nodes */}
      <circle cx="195" cy="24" r="4.5" fill="#10233F" />
      <circle cx="195" cy="108" r="4" fill="#4D83A8" />
      <circle cx="78" cy="108" r="4.5" fill="#F5A623" />
      <circle cx="238" cy="108" r="4" fill="#F5A623" />
      <circle cx="326" cy="75" r="4" fill="#F5A623" />
      <line x1="286" y1="108" x2="326" y2="75" stroke="#F5A623" strokeWidth="1.3" />
    </svg>
  );
}

export function DashboardPage({
  data,
  loading,
  onNavigate,
  onOpenRun,
  onLoadExample,
}: DashboardPageProps) {
  const [seeding, setSeeding] = useState(false);

  const handleLoadExample = async () => {
    setSeeding(true);
    try {
      await onLoadExample();
    } finally {
      setSeeding(false);
    }
  };

  const latestRun = data?.latestRun ?? null;
  const lastActivity = data?.recentActivity?.[0] ?? null;

  // Build Plotly traces for latest simulation overview
  const overviewTraces: Data[] = latestRun
    ? latestRun.states.map((stateName, stateIdx) => {
        const ySeries = latestRun.results.normalizedTrajectory.map((stepVec) => stepVec[stateIdx] ?? 0);
        const xLabels = ySeries.map((_, stepIdx) => `Step ${stepIdx}`);
        const color = CHART_PALETTE[stateIdx % CHART_PALETTE.length];
        return {
          type: 'scatter',
          mode: 'lines+markers',
          name: stateName,
          x: xLabels,
          y: ySeries,
          line: { color, width: 2.5 },
          marker: { color, size: 7 },
          hovertemplate: `<b>${stateName}</b><br>%{x}: %{y:.4f}<extra></extra>`,
        };
      })
    : [];

  return (
    <div className="relative space-y-6 pb-8">
      {/* Hero Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-3xl sm:text-[38px] font-bold tracking-tight text-[#10233F] leading-tight">
            Welcome to Markov Lab!
          </h1>
          <p className="mt-1.5 text-[15px] text-[#4A463F]">
            Explore Markov Chains, predict population changes and analyse long-term behaviour.
          </p>
        </div>
        <HeroMathIllustration />
      </div>

      {/* 4 KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Total Simulations */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] px-5 py-4 shadow-[0_2px_8px_rgba(16,35,63,0.04)]">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-[#10233F] text-white font-serif-display text-2xl font-bold">
            &Sigma;
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[#4A463F]">Total Simulations</div>
            <div className="mt-0.5 font-serif-display text-[28px] font-bold leading-none text-[#10233F] tabular-nums">
              {loading ? '—' : data?.totalSimulations ?? 0}
            </div>
            <div className="mt-1.5 text-xs font-medium text-[#2E7D32] tabular-nums">
              &uarr; +{data?.simulationsThisMonth ?? 0} this month
            </div>
          </div>
        </div>

        {/* Card 2: Completed Runs */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] px-5 py-4 shadow-[0_2px_8px_rgba(16,35,63,0.04)]">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-[#F5A623] text-white">
            <Check className="h-7 w-7 stroke-[2.75]" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[#4A463F]">Completed Runs</div>
            <div className="mt-0.5 font-serif-display text-[28px] font-bold leading-none text-[#10233F] tabular-nums">
              {loading ? '—' : data?.completedRuns ?? 0}
            </div>
            <div className="mt-1.5 text-xs font-medium text-[#2E7D32]">
              {data && data.completedRuns > 0 ? '↑ 100% validated runs' : 'Ready to simulate'}
            </div>
          </div>
        </div>

        {/* Card 3: Saved Matrices */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] px-5 py-4 shadow-[0_2px_8px_rgba(16,35,63,0.04)]">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-[#4D83A8] text-white">
            <Grid3X3 className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[#4A463F]">Saved Matrices</div>
            <div className="mt-0.5 font-serif-display text-[28px] font-bold leading-none text-[#10233F] tabular-nums">
              {loading ? '—' : data?.savedMatrices ?? 0}
            </div>
            <div className="mt-1.5 text-xs font-medium text-[#2E7D32] tabular-nums">
              &uarr; +{data?.matricesThisMonth ?? 0} this month
            </div>
          </div>
        </div>

        {/* Card 4: Last Activity */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] px-5 py-4 shadow-[0_2px_8px_rgba(16,35,63,0.04)]">
          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-[#10233F] text-white">
            <Calendar className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[#4A463F]">Last Activity</div>
            <div className="mt-0.5 font-serif-display text-[20px] font-bold leading-tight text-[#10233F] truncate">
              {loading
                ? '—'
                : lastActivity
                  ? formatRelativeActivityDate(lastActivity.created_at)
                  : 'No activity yet'}
            </div>
            <div className="mt-1 text-xs text-[#6B655B] truncate">
              {lastActivity ? lastActivity.source_page : 'SQLite initialized'}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Simulation Overview & Latest Simulation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Simulation Overview Chart */}
        <div className="lg:col-span-7 flex flex-col rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_10px_rgba(16,35,63,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <BarChart2 className="h-5 w-5 text-[#F5A623]" />
              <h2 className="font-heading text-[16px] font-semibold text-[#10233F]">
                Simulation Overview
              </h2>
            </div>
            {latestRun && (
              <span className="text-xs font-medium text-[#6B655B] truncate max-w-[220px]">
                {latestRun.simulation_name} &middot; {latestRun.iterations} steps
              </span>
            )}
          </div>

          <div className="mt-2 flex-1 flex flex-col justify-center">
            {latestRun ? (
              <PlotlyChart
                data={overviewTraces}
                height={250}
                layout={{
                  margin: { l: 46, r: 16, t: 36, b: 36 },
                  yaxis: {
                    range: [0, 1.05],
                    tickformat: '.1f',
                    title: { text: 'State Share', font: { size: 11, color: '#6B655B' } },
                  },
                }}
              />
            ) : (
              <div className="my-4 rounded-xl border border-dashed border-[#D8CFBE] bg-[#F5F0E6]/60 px-6 py-10 text-center">
                <p className="font-heading text-sm font-semibold text-[#10233F]">
                  No Simulation Runs Recorded Yet
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[#5C574E]">
                  Your SQLite database is connected and ready. Create a population model or load the
                  academic Urban Growth example to inspect real Markov trajectories.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleLoadExample}
                    disabled={seeding}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#F5A623] px-4 py-2 text-xs font-semibold text-[#10233F] hover:bg-[#E59716] transition-colors disabled:opacity-60 whitespace-nowrap"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {seeding ? 'Loading Example...' : 'Load Urban Growth Example'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('simulation-manager')}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#10233F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#19335A] transition-colors whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Custom Simulation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Latest Simulation Summary */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_10px_rgba(16,35,63,0.05)]">
          <div>
            <div className="flex items-center gap-2.5">
              <FlaskConical className="h-5 w-5 text-[#F5A623]" />
              <h2 className="font-heading text-[16px] font-semibold text-[#10233F]">
                Latest Simulation
              </h2>
            </div>

            {latestRun ? (
              <div className="mt-4 space-y-2.5 text-sm">
                <div className="grid grid-cols-[88px_12px_1fr] items-baseline py-0.5">
                  <span className="font-medium text-[#4A463F]">Name</span>
                  <span className="text-[#6B655B]">:</span>
                  <span className="font-semibold text-[#10233F] truncate">
                    {latestRun.simulation_name}
                  </span>
                </div>
                <div className="grid grid-cols-[88px_12px_1fr] items-baseline py-0.5">
                  <span className="font-medium text-[#4A463F]">States</span>
                  <span className="text-[#6B655B]">:</span>
                  <span className="font-medium text-[#292724] tabular-nums">
                    {latestRun.states.length} ({latestRun.states.join(', ')})
                  </span>
                </div>
                <div className="grid grid-cols-[88px_12px_1fr] items-baseline py-0.5">
                  <span className="font-medium text-[#4A463F]">Steps</span>
                  <span className="text-[#6B655B]">:</span>
                  <span className="font-medium text-[#292724] tabular-nums">
                    {latestRun.iterations}
                  </span>
                </div>
                <div className="grid grid-cols-[88px_12px_1fr] items-baseline py-0.5">
                  <span className="font-medium text-[#4A463F]">Date</span>
                  <span className="text-[#6B655B]">:</span>
                  <span className="font-medium text-[#292724] tabular-nums">
                    {formatDisplayDateTime(latestRun.created_at)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-[#EAE2D3] bg-[#F5F0E6]/50 p-4 text-xs text-[#5C574E] leading-relaxed">
                No saved simulation runs found in SQLite. Once you execute and save a run in the
                Markov Simulator, its summary and quick-open link will appear here.
              </div>
            )}
          </div>

          <div className="mt-5 space-y-3">
            {latestRun ? (
              <>
                <div className="flex items-center justify-center gap-2 rounded-lg border border-[#CBE2F2] bg-[#E3F1FB] px-4 py-2.5 text-sm font-medium text-[#10233F]">
                  <CheckCircle2 className="h-4.5 w-4.5 text-[#15803D]" />
                  <span>Simulation Completed Successfully!</span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenRun(latestRun)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#10233F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#19335A] transition-colors whitespace-nowrap"
                >
                  <BarChart2 className="h-4 w-4" />
                  <span>View Results</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('markov-simulator')}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#10233F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#19335A] transition-colors whitespace-nowrap"
              >
                <Play className="h-4 w-4" />
                <span>Open Markov Simulator</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Recent Activity Table */}
        <div className="lg:col-span-7 rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_10px_rgba(16,35,63,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Clock className="h-5 w-5 text-[#F5A623]" />
              <h2 className="font-heading text-[16px] font-semibold text-[#10233F]">
                Recent Activity
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('history-help')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#10233F] hover:text-[#4D83A8] transition-colors whitespace-nowrap"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3.5 overflow-x-auto">
            {data && data.recentActivity.length > 0 ? (
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-[#E7E0D0] bg-[#F6F1E7] text-[#4A463F]">
                    <th className="py-2.5 px-3 font-semibold rounded-tl-lg">Date &amp; Time</th>
                    <th className="py-2.5 px-3 font-semibold">Simulation Name</th>
                    <th className="py-2.5 px-3 font-semibold">Type</th>
                    <th className="py-2.5 px-3 font-semibold rounded-tr-lg">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE9DA]">
                  {data.recentActivity.slice(0, 5).map((item) => (
                    <tr key={item.activity_id} className="hover:bg-[#FAF6ED] transition-colors">
                      <td className="py-2.5 px-3 text-[#4A463F] whitespace-nowrap tabular-nums">
                        {formatDisplayDateTime(item.created_at)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#10233F] max-w-[200px] truncate">
                        {item.name}
                      </td>
                      <td className="py-2.5 px-3 text-[#4A463F] whitespace-nowrap">{item.type}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#15803D]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{item.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rounded-lg border border-[#EAE2D3] bg-[#F5F0E6]/40 py-8 px-4 text-center text-xs text-[#6B655B]">
                No database activity recorded yet. Create a simulation or build a transition matrix
                to populate your history log.
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-5 shadow-[0_2px_10px_rgba(16,35,63,0.05)]">
          <div className="flex items-center gap-2.5">
            <Zap className="h-5 w-5 text-[#F5A623]" />
            <h2 className="font-heading text-[16px] font-semibold text-[#10233F]">Quick Actions</h2>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 flex-1 items-stretch">
            <button
              type="button"
              onClick={() => onNavigate('simulation-manager')}
              className="flex flex-col items-center justify-center gap-2.5 rounded-xl bg-[#10233F] px-3 py-5 text-white hover:bg-[#19335A] transition-colors shadow-xs"
            >
              <Plus className="h-7 w-7 stroke-[2.5]" />
              <span className="text-[13px] font-semibold leading-tight text-center">
                Create
                <br />
                Simulation
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('matrix-builder')}
              className="flex flex-col items-center justify-center gap-2.5 rounded-xl bg-[#F5A623] px-3 py-5 text-white hover:bg-[#E59716] transition-colors shadow-xs"
            >
              <Grid3X3 className="h-7 w-7" />
              <span className="text-[13px] font-semibold leading-tight text-center">
                Build
                <br />
                Matrix
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('markov-simulator')}
              className="flex flex-col items-center justify-center gap-2.5 rounded-xl bg-[#4D83A8] px-3 py-5 text-white hover:bg-[#3F7091] transition-colors shadow-xs"
            >
              <Play className="h-7 w-7 fill-current" />
              <span className="text-[13px] font-semibold leading-tight text-center">
                Run
                <br />
                Simulator
              </span>
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-[#6B655B]">
            <span>Convention: v(k+1) = P &times; v(k)</span>
            <span className="font-serif-display italic text-[#4D83A8]">P&#8319; &rarr; &Pi;</span>
          </div>
        </div>
      </div>
    </div>
  );
}
