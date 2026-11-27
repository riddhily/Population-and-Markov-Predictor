import type {
  DashboardData,
  HealthStatus,
  InitialPopulationPayload,
  Simulation,
  SimulationResultsPayload,
  SimulationRun,
  TransitionMatrix,
} from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getHealth: () => request<HealthStatus>('/api/health'),
  getDashboard: () => request<DashboardData>('/api/dashboard'),

  getSimulations: () => request<Simulation[]>('/api/simulations'),
  createSimulation: (payload: { name: string; description: string; states: string[] }) =>
    request<Simulation>('/api/simulations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSimulation: (id: number, payload: { name: string; description: string; states: string[] }) =>
    request<Simulation>(`/api/simulations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteSimulation: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/simulations/${id}`, {
      method: 'DELETE',
    }),

  getMatrices: (simulationId?: number) =>
    request<TransitionMatrix[]>(
      simulationId ? `/api/matrices?simulation_id=${simulationId}` : '/api/matrices'
    ),
  createMatrix: (payload: {
    simulation_id: number;
    matrix_name: string;
    matrix_data: number[][];
    generation_type: 'manual' | 'automatic';
  }) =>
    request<TransitionMatrix>('/api/matrices', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMatrix: (
    id: number,
    payload: {
      matrix_name: string;
      matrix_data: number[][];
      generation_type: 'manual' | 'automatic';
    }
  ) =>
    request<TransitionMatrix>(`/api/matrices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteMatrix: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/matrices/${id}`, {
      method: 'DELETE',
    }),

  getRuns: (simulationId?: number) =>
    request<SimulationRun[]>(simulationId ? `/api/runs?simulation_id=${simulationId}` : '/api/runs'),
  getRun: (id: number) => request<SimulationRun>(`/api/runs/${id}`),
  createRun: (payload: {
    simulation_id: number;
    matrix_id: number;
    initial_population: InitialPopulationPayload;
    iterations: number;
    results: SimulationResultsPayload;
  }) =>
    request<SimulationRun>('/api/runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteRun: (id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/runs/${id}`, {
      method: 'DELETE',
    }),

  seedExample: () =>
    request<{ simulation_id: number; matrix_id: number; run_id: number }>('/api/seed-example', {
      method: 'POST',
    }),
};
