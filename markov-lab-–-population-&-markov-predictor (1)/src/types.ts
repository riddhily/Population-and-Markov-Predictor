export type PageId =
  | 'dashboard'
  | 'simulation-manager'
  | 'matrix-builder'
  | 'markov-simulator'
  | 'mathematical-analysis'
  | 'history-help';

export type PopulationMode = 'probability' | 'counts';

export interface Simulation {
  id: number;
  name: string;
  description: string;
  states: string[];
  created_at: string;
  updated_at: string;
  matrix_count?: number;
  run_count?: number;
}

export interface TransitionMatrix {
  id: number;
  simulation_id: number;
  simulation_name?: string;
  states?: string[];
  matrix_name: string;
  matrix_data: number[][];
  generation_type: 'manual' | 'automatic';
  created_at: string;
}

export interface InitialPopulationPayload {
  mode: PopulationMode;
  values: number[];
  unitLabel?: string;
}

export interface SimulationResultsPayload {
  mode: PopulationMode;
  totalPopulation: number;
  trajectory: number[][]; // [step][stateIdx]
  normalizedTrajectory: number[][]; // [step][stateIdx] always summing to 1
  deltas: number[][]; // [step-1][stateIdx]
  finalDistribution: number[];
}

export interface SimulationRun {
  id: number;
  simulation_id: number;
  matrix_id: number;
  simulation_name: string;
  matrix_name: string;
  generation_type?: 'manual' | 'automatic';
  states: string[];
  matrix_data: number[][];
  initial_population: InitialPopulationPayload;
  iterations: number;
  results: SimulationResultsPayload;
  created_at: string;
}

export interface ActivityItem {
  activity_id: string;
  ref_id: number;
  name: string;
  type: string;
  status: string;
  created_at: string;
  source_page: string;
}

export interface DashboardData {
  totalSimulations: number;
  simulationsThisMonth: number;
  completedRuns: number;
  savedMatrices: number;
  matricesThisMonth: number;
  latestRun: SimulationRun | null;
  recentActivity: ActivityItem[];
}

export interface HealthStatus {
  connected: boolean;
  path: string;
  tables: string[];
}
