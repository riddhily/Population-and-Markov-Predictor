import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { checkDatabaseHealth, getDb } from './server/db.ts';

const PORT = Number(process.env.PORT) || 3000;

function validateStochasticMatrix(matrix: unknown, expectedSize?: number): { valid: boolean; error?: string } {
  if (!Array.isArray(matrix) || matrix.length < 2) {
    return { valid: false, error: 'Matrix must be a square 2D array with at least 2 states.' };
  }
  const n = matrix.length;
  if (expectedSize !== undefined && n !== expectedSize) {
    return { valid: false, error: `Matrix dimension (${n}×${n}) does not match simulation state count (${expectedSize}).` };
  }
  for (let i = 0; i < n; i++) {
    if (!Array.isArray(matrix[i]) || matrix[i].length !== n) {
      return { valid: false, error: 'Matrix must be strictly square (rows = columns).' };
    }
    for (let j = 0; j < n; j++) {
      const val = Number(matrix[i][j]);
      if (!Number.isFinite(val) || val < -1e-9 || val > 1 + 1e-9) {
        return { valid: false, error: `Entry (${i + 1}, ${j + 1}) must be between 0 and 1.` };
      }
    }
  }
  for (let j = 0; j < n; j++) {
    let colSum = 0;
    for (let i = 0; i < n; i++) {
      colSum += Number(matrix[i][j]);
    }
    if (Math.abs(colSum - 1) > 1e-4) {
      return {
        valid: false,
        error: `Column ${j + 1} sums to ${colSum.toFixed(4)} instead of 1.0000 (column-vector convention requires every column to sum to 1).`,
      };
    }
  }
  return { valid: true };
}

async function startServer() {
  // Initialize SQLite database and ensure markov_lab.db tables exist immediately on boot
  getDb();

  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Health Check
  app.get('/api/health', (_req, res) => {
    try {
      const health = checkDatabaseHealth();
      res.json(health);
    } catch (err) {
      res.status(500).json({ connected: false, error: err instanceof Error ? err.message : 'Database error' });
    }
  });

  // Dashboard Summary (100% derived from SQLite)
  app.get('/api/dashboard', (_req, res) => {
    try {
      const db = getDb();
      const simCountRow = db.prepare('SELECT COUNT(*) AS count FROM simulations').get() as { count: number };
      const simMonthRow = db
        .prepare("SELECT COUNT(*) AS count FROM simulations WHERE created_at >= datetime('now', '-30 days')")
        .get() as { count: number };

      const runCountRow = db.prepare('SELECT COUNT(*) AS count FROM simulation_runs').get() as { count: number };
      const matrixCountRow = db.prepare('SELECT COUNT(*) AS count FROM transition_matrices').get() as { count: number };
      const matrixMonthRow = db
        .prepare("SELECT COUNT(*) AS count FROM transition_matrices WHERE created_at >= datetime('now', '-30 days')")
        .get() as { count: number };

      const latestRun = db
        .prepare(`
          SELECT
            r.id, r.simulation_id, r.matrix_id, r.initial_population, r.iterations, r.results, r.created_at,
            s.name AS simulation_name, s.states AS states_json,
            m.matrix_name, m.matrix_data
          FROM simulation_runs r
          JOIN simulations s ON r.simulation_id = s.id
          JOIN transition_matrices m ON r.matrix_id = m.id
          ORDER BY r.created_at DESC, r.id DESC
          LIMIT 1
        `)
        .get() as Record<string, unknown> | undefined;

      const recentActivity = db
        .prepare(`
          SELECT * FROM (
            SELECT
              'run-' || r.id AS activity_id,
              r.id AS ref_id,
              s.name AS name,
              'Simulation' AS type,
              'Completed' AS status,
              r.created_at AS created_at,
              'Markov Simulator' AS source_page
            FROM simulation_runs r
            JOIN simulations s ON r.simulation_id = s.id

            UNION ALL

            SELECT
              'mat-' || m.id AS activity_id,
              m.id AS ref_id,
              m.matrix_name || ' (' || s.name || ')' AS name,
              CASE WHEN m.generation_type = 'automatic' THEN 'Auto Matrix' ELSE 'Manual Matrix' END AS type,
              'Saved' AS status,
              m.created_at AS created_at,
              'Matrix Builder' AS source_page
            FROM transition_matrices m
            JOIN simulations s ON m.simulation_id = s.id

            UNION ALL

            SELECT
              'sim-' || s.id AS activity_id,
              s.id AS ref_id,
              s.name AS name,
              'Model Setup' AS type,
              'Active' AS status,
              s.created_at AS created_at,
              'Simulation Manager' AS source_page
            FROM simulations s
          )
          ORDER BY created_at DESC
          LIMIT 8
        `)
        .all();

      res.json({
        totalSimulations: simCountRow.count,
        simulationsThisMonth: simMonthRow.count,
        completedRuns: runCountRow.count,
        savedMatrices: matrixCountRow.count,
        matricesThisMonth: matrixMonthRow.count,
        latestRun: latestRun
          ? {
              ...latestRun,
              states: JSON.parse(String(latestRun.states_json)),
              initial_population: JSON.parse(String(latestRun.initial_population)),
              results: JSON.parse(String(latestRun.results)),
              matrix_data: JSON.parse(String(latestRun.matrix_data)),
            }
          : null,
        recentActivity,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load dashboard' });
    }
  });

  // Simulations CRUD
  app.get('/api/simulations', (_req, res) => {
    try {
      const db = getDb();
      const rows = db
        .prepare(`
          SELECT
            s.*,
            (SELECT COUNT(*) FROM transition_matrices m WHERE m.simulation_id = s.id) AS matrix_count,
            (SELECT COUNT(*) FROM simulation_runs r WHERE r.simulation_id = s.id) AS run_count
          FROM simulations s
          ORDER BY s.updated_at DESC, s.id DESC
        `)
        .all() as Record<string, unknown>[];

      res.json(
        rows.map((r) => ({
          ...r,
          states: JSON.parse(String(r.states)),
        }))
      );
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch simulations' });
    }
  });

  app.post('/api/simulations', (req, res) => {
    try {
      const { name, description = '', states } = req.body ?? {};
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Simulation name is required.' });
        return;
      }
      if (!Array.isArray(states) || states.length < 2) {
        res.status(400).json({ error: 'At least 2 population states are required.' });
        return;
      }
      const cleanedStates = states.map((s) => String(s).trim()).filter(Boolean);
      if (cleanedStates.length < 2) {
        res.status(400).json({ error: 'All state names must be non-empty (minimum 2 states).' });
        return;
      }
      const uniqueStates = new Set(cleanedStates.map((s) => s.toLowerCase()));
      if (uniqueStates.size !== cleanedStates.length) {
        res.status(400).json({ error: 'State names must be unique.' });
        return;
      }

      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO simulations (name, description, states, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `);
      const info = stmt.run(name.trim(), String(description).trim(), JSON.stringify(cleanedStates));
      const created = db.prepare('SELECT * FROM simulations WHERE id = ?').get(info.lastInsertRowid) as Record<string, unknown>;
      res.status(201).json({
        ...created,
        states: JSON.parse(String(created.states)),
        matrix_count: 0,
        run_count: 0,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create simulation' });
    }
  });

  app.put('/api/simulations/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name, description = '', states } = req.body ?? {};
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid simulation ID.' });
        return;
      }
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Simulation name is required.' });
        return;
      }
      if (!Array.isArray(states) || states.length < 2) {
        res.status(400).json({ error: 'At least 2 population states are required.' });
        return;
      }
      const cleanedStates = states.map((s) => String(s).trim()).filter(Boolean);
      if (cleanedStates.length < 2) {
        res.status(400).json({ error: 'All state names must be non-empty (minimum 2 states).' });
        return;
      }
      const uniqueStates = new Set(cleanedStates.map((s) => s.toLowerCase()));
      if (uniqueStates.size !== cleanedStates.length) {
        res.status(400).json({ error: 'State names must be unique.' });
        return;
      }

      const db = getDb();
      const existing = db.prepare('SELECT * FROM simulations WHERE id = ?').get(id) as { states: string } | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Simulation not found.' });
        return;
      }

      const prevStates: string[] = JSON.parse(existing.states);
      if (prevStates.length !== cleanedStates.length) {
        const matCount = (
          db.prepare('SELECT COUNT(*) AS count FROM transition_matrices WHERE simulation_id = ?').get(id) as { count: number }
        ).count;
        if (matCount > 0) {
          res.status(409).json({
            error: `Cannot change the number of states (${prevStates.length} → ${cleanedStates.length}) while ${matCount} saved matrix/matrices depend on it. Delete associated matrices first or create a new simulation.`,
          });
          return;
        }
      }

      db.prepare(`
        UPDATE simulations
        SET name = ?, description = ?, states = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(name.trim(), String(description).trim(), JSON.stringify(cleanedStates), id);

      const updated = db.prepare(`
        SELECT s.*,
          (SELECT COUNT(*) FROM transition_matrices m WHERE m.simulation_id = s.id) AS matrix_count,
          (SELECT COUNT(*) FROM simulation_runs r WHERE r.simulation_id = s.id) AS run_count
        FROM simulations s WHERE s.id = ?
      `).get(id) as Record<string, unknown>;

      res.json({ ...updated, states: JSON.parse(String(updated.states)) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update simulation' });
    }
  });

  app.delete('/api/simulations/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid simulation ID.' });
        return;
      }
      const db = getDb();
      const info = db.prepare('DELETE FROM simulations WHERE id = ?').run(id);
      if (info.changes === 0) {
        res.status(404).json({ error: 'Simulation not found.' });
        return;
      }
      res.json({ deleted: true, id });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete simulation' });
    }
  });

  // Transition Matrices CRUD
  app.get('/api/matrices', (req, res) => {
    try {
      const db = getDb();
      const simId = req.query.simulation_id ? Number(req.query.simulation_id) : null;
      const rows = (
        simId
          ? db
              .prepare(`
                SELECT m.*, s.name AS simulation_name, s.states AS states_json
                FROM transition_matrices m
                JOIN simulations s ON m.simulation_id = s.id
                WHERE m.simulation_id = ?
                ORDER BY m.created_at DESC, m.id DESC
              `)
              .all(simId)
          : db
              .prepare(`
                SELECT m.*, s.name AS simulation_name, s.states AS states_json
                FROM transition_matrices m
                JOIN simulations s ON m.simulation_id = s.id
                ORDER BY m.created_at DESC, m.id DESC
              `)
              .all()
      ) as Record<string, unknown>[];

      res.json(
        rows.map((r) => ({
          ...r,
          matrix_data: JSON.parse(String(r.matrix_data)),
          states: JSON.parse(String(r.states_json)),
        }))
      );
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch matrices' });
    }
  });

  app.post('/api/matrices', (req, res) => {
    try {
      const { simulation_id, matrix_name, matrix_data, generation_type = 'manual' } = req.body ?? {};
      const simId = Number(simulation_id);
      if (!Number.isInteger(simId) || simId <= 0) {
        res.status(400).json({ error: 'Valid simulation_id is required.' });
        return;
      }
      if (!matrix_name || typeof matrix_name !== 'string' || !matrix_name.trim()) {
        res.status(400).json({ error: 'Matrix name is required.' });
        return;
      }
      if (generation_type !== 'manual' && generation_type !== 'automatic') {
        res.status(400).json({ error: 'generation_type must be manual or automatic.' });
        return;
      }

      const db = getDb();
      const sim = db.prepare('SELECT id, name, states FROM simulations WHERE id = ?').get(simId) as
        | { id: number; name: string; states: string }
        | undefined;
      if (!sim) {
        res.status(404).json({ error: 'Target simulation not found.' });
        return;
      }
      const states: string[] = JSON.parse(sim.states);
      const validation = validateStochasticMatrix(matrix_data, states.length);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const info = db
        .prepare(`
          INSERT INTO transition_matrices (simulation_id, matrix_name, matrix_data, generation_type, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `)
        .run(simId, matrix_name.trim(), JSON.stringify(matrix_data), generation_type);

      db.prepare("UPDATE simulations SET updated_at = datetime('now') WHERE id = ?").run(simId);

      const created = db
        .prepare(`
          SELECT m.*, s.name AS simulation_name, s.states AS states_json
          FROM transition_matrices m
          JOIN simulations s ON m.simulation_id = s.id
          WHERE m.id = ?
        `)
        .get(info.lastInsertRowid) as Record<string, unknown>;

      res.status(201).json({
        ...created,
        matrix_data: JSON.parse(String(created.matrix_data)),
        states: JSON.parse(String(created.states_json)),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save matrix' });
    }
  });

  app.put('/api/matrices/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      const { matrix_name, matrix_data, generation_type } = req.body ?? {};
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid matrix ID.' });
        return;
      }
      const db = getDb();
      const existing = db
        .prepare(`
          SELECT m.*, s.states AS states_json
          FROM transition_matrices m
          JOIN simulations s ON m.simulation_id = s.id
          WHERE m.id = ?
        `)
        .get(id) as { id: number; simulation_id: number; matrix_name: string; generation_type: string; states_json: string } | undefined;

      if (!existing) {
        res.status(404).json({ error: 'Matrix not found.' });
        return;
      }

      const states: string[] = JSON.parse(existing.states_json);
      const validation = validateStochasticMatrix(matrix_data, states.length);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const nextName = matrix_name && typeof matrix_name === 'string' && matrix_name.trim() ? matrix_name.trim() : existing.matrix_name;
      const nextGenType = generation_type === 'automatic' || generation_type === 'manual' ? generation_type : existing.generation_type;

      db.prepare(`
        UPDATE transition_matrices
        SET matrix_name = ?, matrix_data = ?, generation_type = ?
        WHERE id = ?
      `).run(nextName, JSON.stringify(matrix_data), nextGenType, id);

      db.prepare("UPDATE simulations SET updated_at = datetime('now') WHERE id = ?").run(existing.simulation_id);

      const updated = db
        .prepare(`
          SELECT m.*, s.name AS simulation_name, s.states AS states_json
          FROM transition_matrices m
          JOIN simulations s ON m.simulation_id = s.id
          WHERE m.id = ?
        `)
        .get(id) as Record<string, unknown>;

      res.json({
        ...updated,
        matrix_data: JSON.parse(String(updated.matrix_data)),
        states: JSON.parse(String(updated.states_json)),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update matrix' });
    }
  });

  app.delete('/api/matrices/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid matrix ID.' });
        return;
      }
      const db = getDb();
      const info = db.prepare('DELETE FROM transition_matrices WHERE id = ?').run(id);
      if (info.changes === 0) {
        res.status(404).json({ error: 'Matrix not found.' });
        return;
      }
      res.json({ deleted: true, id });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete matrix' });
    }
  });

  // Simulation Runs CRUD
  app.get('/api/runs', (req, res) => {
    try {
      const db = getDb();
      const simId = req.query.simulation_id ? Number(req.query.simulation_id) : null;
      const rows = (
        simId
          ? db
              .prepare(`
                SELECT r.*, s.name AS simulation_name, s.states AS states_json, m.matrix_name, m.matrix_data, m.generation_type
                FROM simulation_runs r
                JOIN simulations s ON r.simulation_id = s.id
                JOIN transition_matrices m ON r.matrix_id = m.id
                WHERE r.simulation_id = ?
                ORDER BY r.created_at DESC, r.id DESC
              `)
              .all(simId)
          : db
              .prepare(`
                SELECT r.*, s.name AS simulation_name, s.states AS states_json, m.matrix_name, m.matrix_data, m.generation_type
                FROM simulation_runs r
                JOIN simulations s ON r.simulation_id = s.id
                JOIN transition_matrices m ON r.matrix_id = m.id
                ORDER BY r.created_at DESC, r.id DESC
              `)
              .all()
      ) as Record<string, unknown>[];

      res.json(
        rows.map((r) => ({
          ...r,
          states: JSON.parse(String(r.states_json)),
          initial_population: JSON.parse(String(r.initial_population)),
          results: JSON.parse(String(r.results)),
          matrix_data: JSON.parse(String(r.matrix_data)),
        }))
      );
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch simulation runs' });
    }
  });

  app.get('/api/runs/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid run ID.' });
        return;
      }
      const db = getDb();
      const row = db
        .prepare(`
          SELECT r.*, s.name AS simulation_name, s.states AS states_json, m.matrix_name, m.matrix_data, m.generation_type
          FROM simulation_runs r
          JOIN simulations s ON r.simulation_id = s.id
          JOIN transition_matrices m ON r.matrix_id = m.id
          WHERE r.id = ?
        `)
        .get(id) as Record<string, unknown> | undefined;

      if (!row) {
        res.status(404).json({ error: 'Simulation run not found.' });
        return;
      }
      res.json({
        ...row,
        states: JSON.parse(String(row.states_json)),
        initial_population: JSON.parse(String(row.initial_population)),
        results: JSON.parse(String(row.results)),
        matrix_data: JSON.parse(String(row.matrix_data)),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch simulation run' });
    }
  });

  app.post('/api/runs', (req, res) => {
    try {
      const { simulation_id, matrix_id, initial_population, iterations, results } = req.body ?? {};
      const simId = Number(simulation_id);
      const matId = Number(matrix_id);
      const iterNum = Number(iterations);

      if (!Number.isInteger(simId) || simId <= 0 || !Number.isInteger(matId) || matId <= 0) {
        res.status(400).json({ error: 'Valid simulation_id and matrix_id are required.' });
        return;
      }
      if (!Number.isInteger(iterNum) || iterNum < 1 || iterNum > 500) {
        res.status(400).json({ error: 'Iterations must be an integer between 1 and 500.' });
        return;
      }
      if (!initial_population || !results) {
        res.status(400).json({ error: 'initial_population and results are required.' });
        return;
      }

      const db = getDb();
      const matrixRow = db
        .prepare('SELECT id FROM transition_matrices WHERE id = ? AND simulation_id = ?')
        .get(matId, simId);
      if (!matrixRow) {
        res.status(404).json({ error: 'Matching transition matrix not found for this simulation.' });
        return;
      }

      const info = db
        .prepare(`
          INSERT INTO simulation_runs (simulation_id, matrix_id, initial_population, iterations, results, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `)
        .run(simId, matId, JSON.stringify(initial_population), iterNum, JSON.stringify(results));

      db.prepare("UPDATE simulations SET updated_at = datetime('now') WHERE id = ?").run(simId);

      const created = db
        .prepare(`
          SELECT r.*, s.name AS simulation_name, s.states AS states_json, m.matrix_name, m.matrix_data, m.generation_type
          FROM simulation_runs r
          JOIN simulations s ON r.simulation_id = s.id
          JOIN transition_matrices m ON r.matrix_id = m.id
          WHERE r.id = ?
        `)
        .get(info.lastInsertRowid) as Record<string, unknown>;

      res.status(201).json({
        ...created,
        states: JSON.parse(String(created.states_json)),
        initial_population: JSON.parse(String(created.initial_population)),
        results: JSON.parse(String(created.results)),
        matrix_data: JSON.parse(String(created.matrix_data)),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save simulation run' });
    }
  });

  app.delete('/api/runs/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid run ID.' });
        return;
      }
      const db = getDb();
      const info = db.prepare('DELETE FROM simulation_runs WHERE id = ?').run(id);
      if (info.changes === 0) {
        res.status(404).json({ error: 'Simulation run not found.' });
        return;
      }
      res.json({ deleted: true, id });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete simulation run' });
    }
  });

  // Explicit Academic Example Loader (only called when user clicks "Load Example Dataset")
  app.post('/api/seed-example', (_req, res) => {
    try {
      const db = getDb();
      const states = ['Urban Population', 'Rural Population', 'Migrated Population'];
      const simInfo = db
        .prepare(`
          INSERT INTO simulations (name, description, states, created_at, updated_at)
          VALUES (?, ?, ?, datetime('now'), datetime('now'))
        `)
        .run(
          'Urban Growth Model',
          'Regional demographic shift tracking annual transitions across Urban, Rural, and Migrated populations.',
          JSON.stringify(states)
        );
      const simId = Number(simInfo.lastInsertRowid);

      // Column-stochastic matrix P where columns sum to 1.0000
      const matrixData = [
        [0.85, 0.22, 0.30],
        [0.08, 0.70, 0.15],
        [0.07, 0.08, 0.55],
      ];

      const matInfo = db
        .prepare(`
          INSERT INTO transition_matrices (simulation_id, matrix_name, matrix_data, generation_type, created_at)
          VALUES (?, ?, ?, 'manual', datetime('now'))
        `)
        .run(simId, 'Baseline Migration Matrix', JSON.stringify(matrixData));
      const matId = Number(matInfo.lastInsertRowid);

      const v0 = [0.47, 0.31, 0.22];
      const iterations = 5;
      const trajectory: number[][] = [v0];
      for (let k = 0; k < iterations; k++) {
        const prev = trajectory[k];
        const next = matrixData.map((row) =>
          row.reduce((acc, val, j) => acc + val * prev[j], 0)
        );
        trajectory.push(next);
      }
      const deltas = trajectory.slice(1).map((curr, idx) => curr.map((val, i) => val - trajectory[idx][i]));

      const initialPopPayload = {
        mode: 'probability',
        values: v0,
        unitLabel: 'Year',
      };
      const resultsPayload = {
        mode: 'probability',
        totalPopulation: 1,
        trajectory,
        normalizedTrajectory: trajectory,
        deltas,
        finalDistribution: trajectory[trajectory.length - 1],
      };

      const runInfo = db
        .prepare(`
          INSERT INTO simulation_runs (simulation_id, matrix_id, initial_population, iterations, results, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `)
        .run(simId, matId, JSON.stringify(initialPopPayload), iterations, JSON.stringify(resultsPayload));

      res.status(201).json({
        simulation_id: simId,
        matrix_id: matId,
        run_id: Number(runInfo.lastInsertRowid),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load example dataset' });
    }
  });

  // Vite / Static Frontend Serving
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Markov Lab server running on http://localhost:${PORT}`);
  });
}

startServer();
