import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_FILE = Path(__file__).resolve().parent / "markov_lab.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_FILE), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS simulations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                states TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS transition_matrices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                simulation_id INTEGER NOT NULL,
                matrix_name TEXT NOT NULL,
                matrix_data TEXT NOT NULL,
                generation_type TEXT NOT NULL CHECK(generation_type IN ('manual', 'automatic')),
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (simulation_id) REFERENCES simulations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS simulation_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                simulation_id INTEGER NOT NULL,
                matrix_id INTEGER NOT NULL,
                initial_population TEXT NOT NULL,
                iterations INTEGER NOT NULL,
                results TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (simulation_id) REFERENCES simulations(id) ON DELETE CASCADE,
                FOREIGN KEY (matrix_id) REFERENCES transition_matrices(id) ON DELETE CASCADE
            );
            """
        )
        conn.commit()
    finally:
        conn.close()


def check_connection() -> bool:
    try:
        conn = get_connection()
        conn.execute("SELECT 1").fetchone()
        conn.close()
        return True
    except sqlite3.Error:
        return False


def create_simulation(name: str, description: str, states: List[str]) -> int:
    conn = get_connection()
    try:
        cur = conn.execute(
            "INSERT INTO simulations (name, description, states) VALUES (?, ?, ?)",
            (name.strip(), description.strip(), json.dumps(states)),
        )
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def update_simulation(sim_id: int, name: str, description: str, states: List[str]) -> None:
    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE simulations
            SET name = ?, description = ?, states = ?, updated_at = datetime('now')
            WHERE id = ?
            """,
            (name.strip(), description.strip(), json.dumps(states), sim_id),
        )
        conn.commit()
    finally:
        conn.close()


def delete_simulation(sim_id: int) -> None:
    conn = get_connection()
    try:
        conn.execute("DELETE FROM simulations WHERE id = ?", (sim_id,))
        conn.commit()
    finally:
        conn.close()


def get_simulations() -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT s.*,
              (SELECT COUNT(*) FROM transition_matrices m WHERE m.simulation_id = s.id) AS matrix_count,
              (SELECT COUNT(*) FROM simulation_runs r WHERE r.simulation_id = s.id) AS run_count
            FROM simulations s
            ORDER BY s.updated_at DESC, s.id DESC
            """
        ).fetchall()
        result = []
        for r in rows:
            item = dict(r)
            item["states"] = json.loads(item["states"])
            result.append(item)
        return result
    finally:
        conn.close()


def create_matrix(simulation_id: int, matrix_name: str, matrix_data: List[List[float]], generation_type: str) -> int:
    conn = get_connection()
    try:
        cur = conn.execute(
            """
            INSERT INTO transition_matrices (simulation_id, matrix_name, matrix_data, generation_type)
            VALUES (?, ?, ?, ?)
            """,
            (simulation_id, matrix_name.strip(), json.dumps(matrix_data), generation_type),
        )
        conn.execute("UPDATE simulations SET updated_at = datetime('now') WHERE id = ?", (simulation_id,))
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def update_matrix(matrix_id: int, matrix_name: str, matrix_data: List[List[float]], generation_type: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE transition_matrices
            SET matrix_name = ?, matrix_data = ?, generation_type = ?
            WHERE id = ?
            """,
            (matrix_name.strip(), json.dumps(matrix_data), generation_type, matrix_id),
        )
        conn.commit()
    finally:
        conn.close()


def delete_matrix(matrix_id: int) -> None:
    conn = get_connection()
    try:
        conn.execute("DELETE FROM transition_matrices WHERE id = ?", (matrix_id,))
        conn.commit()
    finally:
        conn.close()


def get_matrices(simulation_id: Optional[int] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        query = """
            SELECT m.*, s.name AS simulation_name, s.states AS states_json
            FROM transition_matrices m
            JOIN simulations s ON m.simulation_id = s.id
        """
        params: tuple = ()
        if simulation_id is not None:
            query += " WHERE m.simulation_id = ?"
            params = (simulation_id,)
        query += " ORDER BY m.created_at DESC, m.id DESC"
        rows = conn.execute(query, params).fetchall()
        result = []
        for r in rows:
            item = dict(r)
            item["matrix_data"] = json.loads(item["matrix_data"])
            item["states"] = json.loads(item["states_json"])
            result.append(item)
        return result
    finally:
        conn.close()


def create_run(
    simulation_id: int,
    matrix_id: int,
    initial_population: Dict[str, Any],
    iterations: int,
    results: Dict[str, Any],
) -> int:
    conn = get_connection()
    try:
        cur = conn.execute(
            """
            INSERT INTO simulation_runs (simulation_id, matrix_id, initial_population, iterations, results)
            VALUES (?, ?, ?, ?, ?)
            """,
            (simulation_id, matrix_id, json.dumps(initial_population), iterations, json.dumps(results)),
        )
        conn.execute("UPDATE simulations SET updated_at = datetime('now') WHERE id = ?", (simulation_id,))
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def delete_run(run_id: int) -> None:
    conn = get_connection()
    try:
        conn.execute("DELETE FROM simulation_runs WHERE id = ?", (run_id,))
        conn.commit()
    finally:
        conn.close()


def get_runs(simulation_id: Optional[int] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        query = """
            SELECT r.*, s.name AS simulation_name, s.states AS states_json,
                   m.matrix_name, m.matrix_data, m.generation_type
            FROM simulation_runs r
            JOIN simulations s ON r.simulation_id = s.id
            JOIN transition_matrices m ON r.matrix_id = m.id
        """
        params: tuple = ()
        if simulation_id is not None:
            query += " WHERE r.simulation_id = ?"
            params = (simulation_id,)
        query += " ORDER BY r.created_at DESC, r.id DESC"
        rows = conn.execute(query, params).fetchall()
        result = []
        for r in rows:
            item = dict(r)
            item["states"] = json.loads(item["states_json"])
            item["initial_population"] = json.loads(item["initial_population"])
            item["results"] = json.loads(item["results"])
            item["matrix_data"] = json.loads(item["matrix_data"])
            result.append(item)
        return result
    finally:
        conn.close()


def get_dashboard_summary() -> Dict[str, Any]:
    conn = get_connection()
    try:
        total_sims = conn.execute("SELECT COUNT(*) FROM simulations").fetchone()[0]
        total_runs = conn.execute("SELECT COUNT(*) FROM simulation_runs").fetchone()[0]
        total_mats = conn.execute("SELECT COUNT(*) FROM transition_matrices").fetchone()[0]
        runs = get_runs()
        latest_run = runs[0] if runs else None
        recent = conn.execute(
            """
            SELECT * FROM (
                SELECT r.created_at, s.name AS simulation_name, 'Simulation' AS type, 'Completed' AS status
                FROM simulation_runs r JOIN simulations s ON r.simulation_id = s.id
                UNION ALL
                SELECT m.created_at, m.matrix_name || ' (' || s.name || ')' AS simulation_name,
                       CASE WHEN m.generation_type='automatic' THEN 'Auto Matrix' ELSE 'Manual Matrix' END AS type,
                       'Saved' AS status
                FROM transition_matrices m JOIN simulations s ON m.simulation_id = s.id
                UNION ALL
                SELECT s.created_at, s.name AS simulation_name, 'Model Setup' AS type, 'Active' AS status
                FROM simulations s
            ) ORDER BY created_at DESC LIMIT 8
            """
        ).fetchall()
        return {
            "total_simulations": total_sims,
            "completed_runs": total_runs,
            "saved_matrices": total_mats,
            "latest_run": latest_run,
            "recent_activity": [dict(r) for r in recent],
        }
    finally:
        conn.close()
