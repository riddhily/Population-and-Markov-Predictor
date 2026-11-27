from typing import Any, Dict, List, Tuple
import numpy as np

TOLERANCE = 1e-4


def validate_transition_matrix(matrix: List[List[float]]) -> Tuple[bool, List[str], List[float]]:
    arr = np.array(matrix, dtype=float)
    errors: List[str] = []
    if arr.ndim != 2 or arr.shape[0] != arr.shape[1] or arr.shape[0] < 2:
        return False, ["Matrix must be square with at least 2 states."], []

    n = arr.shape[0]
    if np.any(np.isnan(arr)) or np.any(arr < -1e-6) or np.any(arr > 1 + 1e-6):
        errors.append("All transition probabilities must lie between 0 and 1.")

    col_sums = arr.sum(axis=0).tolist()
    for j, s in enumerate(col_sums):
        if abs(s - 1.0) > TOLERANCE:
            errors.append(f"Column {j + 1} sums to {s:.4f} (must equal 1.0000).")

    return len(errors) == 0, errors, col_sums


def generate_stochastic_matrix(n: int, profile: str = "high-retention") -> List[List[float]]:
    mat = np.zeros((n, n), dtype=float)
    for j in range(n):
        weights = np.random.exponential(1.0, size=n)
        if profile == "high-retention":
            weights[j] = weights[j] * 2.5 + 3.0
        elif profile == "high-mobility":
            weights[j] = weights[j] * 0.6
        col = np.round(weights / weights.sum(), 4)
        diff = round(1.0 - float(col.sum()), 4)
        col[int(np.argmax(col))] += diff
        mat[:, j] = np.clip(col, 0.0, 1.0)
    return mat.tolist()


def run_markov_simulation(
    matrix: List[List[float]], v0: List[float], iterations: int, mode: str
) -> Dict[str, Any]:
    P = np.array(matrix, dtype=float)
    v = np.array(v0, dtype=float)
    trajectory = [v.tolist()]
    for _ in range(iterations):
        v = P @ v
        trajectory.append(v.tolist())

    traj_arr = np.array(trajectory, dtype=float)
    totals = traj_arr.sum(axis=1, keepdims=True)
    norm_traj = np.where(totals > 0, traj_arr / totals, 0.0)
    deltas = (traj_arr[1:] - traj_arr[:-1]).tolist()

    return {
        "mode": mode,
        "totalPopulation": float(traj_arr[0].sum()),
        "trajectory": trajectory,
        "normalizedTrajectory": norm_traj.tolist(),
        "deltas": deltas,
        "finalDistribution": trajectory[-1],
    }


def analyze_eigen_and_steady_state(matrix: List[List[float]]) -> Dict[str, Any]:
    P = np.array(matrix, dtype=float)
    n = P.shape[0]
    vals, vecs = np.linalg.eig(P)
    order = np.argsort(-np.abs(vals))
    vals = vals[order]
    vecs = vecs[:, order]

    # Steady-state nullspace check for (P - I)
    A = P - np.eye(n)
    _, s_vals, vt = np.linalg.svd(A)
    nullity = int(np.sum(s_vals < 1e-6))
    unit_circle_non_one = [v for v in vals if abs(abs(v) - 1.0) < 1e-4 and abs(v - 1.0) > 1e-4]
    is_periodic = len(unit_circle_non_one) > 0

    stationary = None
    residual = None
    if nullity == 1:
        pi_raw = vt[-1]
        if pi_raw.sum() < 0:
            pi_raw = -pi_raw
        pi = pi_raw / pi_raw.sum()
        stationary = np.where(np.abs(pi) < 1e-9, 0.0, pi).tolist()
        residual = float(np.max(np.abs(P @ np.array(stationary) - np.array(stationary))))

    # Diagonalization check via rank/cond of V
    cond_v = np.linalg.cond(vecs)
    is_diagonalizable = bool(np.isfinite(cond_v) and cond_v < 1e8)
    v_inv = np.linalg.inv(vecs) if is_diagonalizable else None
    recon_err = (
        float(np.max(np.abs(vecs @ np.diag(vals) @ v_inv - P)))
        if is_diagonalizable and v_inv is not None
        else None
    )

    return {
        "eigenvalues": vals,
        "eigenvectors": vecs,
        "nullity": nullity,
        "is_periodic": is_periodic,
        "is_ergodic": nullity == 1 and not is_periodic,
        "stationary_vector": stationary,
        "residual_norm": residual,
        "is_diagonalizable": is_diagonalizable,
        "V": vecs if is_diagonalizable else None,
        "D": np.diag(vals) if is_diagonalizable else None,
        "V_inv": v_inv,
        "reconstruction_error": recon_err,
    }
