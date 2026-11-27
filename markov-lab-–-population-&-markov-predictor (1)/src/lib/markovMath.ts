import * as math from 'mathjs';
import type { PopulationMode, SimulationResultsPayload } from '../types';

export const TOLERANCE = 1e-4;
export const STRICT_TOLERANCE = 1e-6;

export interface MatrixValidationResult {
  valid: boolean;
  columnSums: number[];
  columnErrors: boolean[];
  entryErrors: { row: number; col: number; message: string }[];
  errors: string[];
}

export interface ComplexVal {
  re: number;
  im: number;
}

export interface EigenPair {
  eigenvalue: ComplexVal;
  modulus: number;
  isComplex: boolean;
  eigenvector: ComplexVal[];
}

export interface EigenAnalysisResult {
  eigenvalues: ComplexVal[];
  pairs: EigenPair[];
  dominantEigenvalue: ComplexVal | null;
  secondModulus: number | null;
  spectralGap: number | null;
  hasComplexEigenvalues: boolean;
  isPeriodic: boolean;
  periodEstimate: number;
  interpretation: string[];
}

export interface SteadyStateResult {
  existsUnique: boolean;
  isPeriodic: boolean;
  isErgodic: boolean;
  nullity: number;
  stationaryVector: number[] | null;
  basisVectors: number[][];
  residualNorm: number | null;
  sumCheck: number | null;
  statusLabel: string;
  explanation: string;
  convergenceStepsTo1e4: number | null;
}

export interface DiagonalizationResult {
  isDiagonalizable: boolean;
  isComplex: boolean;
  matrixSize: number;
  independentEigenvectors: number;
  V: ComplexVal[][] | null;
  D: ComplexVal[][] | null;
  VInv: ComplexVal[][] | null;
  reconstructionError: number | null;
  explanation: string;
}

export function validateTransitionMatrix(matrix: number[][]): MatrixValidationResult {
  const n = matrix.length;
  const columnSums: number[] = Array(n).fill(0);
  const columnErrors: boolean[] = Array(n).fill(false);
  const entryErrors: { row: number; col: number; message: string }[] = [];
  const errors: string[] = [];

  if (n < 2) {
    errors.push('Transition matrix must have at least 2 states.');
    return { valid: false, columnSums, columnErrors, entryErrors, errors };
  }

  for (let i = 0; i < n; i++) {
    if (!Array.isArray(matrix[i]) || matrix[i].length !== n) {
      errors.push(`Row ${i + 1} does not have ${n} columns.`);
      continue;
    }
    for (let j = 0; j < n; j++) {
      const val = matrix[i][j];
      if (!Number.isFinite(val)) {
        entryErrors.push({ row: i, col: j, message: `Entry (${i + 1}, ${j + 1}) is not a valid number.` });
      } else if (val < -STRICT_TOLERANCE || val > 1 + STRICT_TOLERANCE) {
        entryErrors.push({
          row: i,
          col: j,
          message: `Entry (${i + 1}, ${j + 1}) = ${val} must be between 0 and 1.`,
        });
      }
      columnSums[j] += Number.isFinite(val) ? val : 0;
    }
  }

  for (let j = 0; j < n; j++) {
    if (Math.abs(columnSums[j] - 1) > TOLERANCE) {
      columnErrors[j] = true;
      errors.push(
        `Column ${j + 1} sums to ${columnSums[j].toFixed(4)} (must sum to 1.0000 under column-vector convention).`
      );
    }
  }

  if (entryErrors.length > 0) {
    errors.unshift(...entryErrors.slice(0, 3).map((e) => e.message));
  }

  return {
    valid: errors.length === 0 && entryErrors.length === 0,
    columnSums,
    columnErrors,
    entryErrors,
    errors,
  };
}

export function normalizeMatrixColumns(matrix: number[][]): number[][] {
  const n = matrix.length;
  const out = matrix.map((row) => [...row]);
  for (let j = 0; j < n; j++) {
    const colVals = out.map((row) => Math.max(0, Number.isFinite(row[j]) ? row[j] : 0));
    const sum = colVals.reduce((a, b) => a + b, 0);
    if (sum <= 0) {
      for (let i = 0; i < n; i++) {
        out[i][j] = i === j ? 1 : 0;
      }
    } else {
      const rounded = colVals.map((v) => Math.round((v / sum) * 10000) / 10000);
      const roundedSum = rounded.reduce((a, b) => a + b, 0);
      const diff = Math.round((1 - roundedSum) * 10000) / 10000;
      let maxIdx = 0;
      for (let i = 1; i < n; i++) {
        if (rounded[i] > rounded[maxIdx]) maxIdx = i;
      }
      rounded[maxIdx] = Math.max(0, Math.round((rounded[maxIdx] + diff) * 10000) / 10000);
      for (let i = 0; i < n; i++) {
        out[i][j] = rounded[i];
      }
    }
  }
  return out;
}

export function generateRandomStochasticMatrix(
  n: number,
  profile: 'balanced' | 'high-retention' | 'high-mobility' = 'high-retention'
): number[][] {
  const mat: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    const raw: number[] = [];
    for (let i = 0; i < n; i++) {
      // Exponential-like draw for natural Dirichlet weights
      const u = Math.max(0.02, Math.random());
      let weight = -Math.log(u);
      if (profile === 'high-retention' && i === j) {
        weight = weight * 2.5 + 3.0;
      } else if (profile === 'high-mobility' && i === j) {
        weight = weight * 0.6;
      }
      raw.push(weight);
    }
    const sum = raw.reduce((a, b) => a + b, 0);
    const rounded = raw.map((w) => Math.round((w / sum) * 10000) / 10000);
    const diff = Math.round((1 - rounded.reduce((a, b) => a + b, 0)) * 10000) / 10000;
    let maxIdx = 0;
    for (let i = 1; i < n; i++) {
      if (rounded[i] > rounded[maxIdx]) maxIdx = i;
    }
    rounded[maxIdx] = Math.max(0, Math.round((rounded[maxIdx] + diff) * 10000) / 10000);
    for (let i = 0; i < n; i++) {
      mat[i][j] = rounded[i];
    }
  }
  return mat;
}

export function validateInitialPopulation(
  values: number[],
  mode: PopulationMode
): { valid: boolean; total: number; error?: string } {
  if (values.length < 2) {
    return { valid: false, total: 0, error: 'At least 2 state values are required.' };
  }
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i]) || values[i] < 0) {
      return { valid: false, total: 0, error: `State ${i + 1} initial value must be non-negative (≥ 0).` };
    }
  }
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    return { valid: false, total: 0, error: 'Total initial population must be greater than 0.' };
  }
  if (mode === 'probability' && Math.abs(total - 1) > TOLERANCE) {
    return {
      valid: false,
      total,
      error: `Probability distribution must sum to 1.0000 (currently ${total.toFixed(4)}). Switch to Population Counts mode if entering raw headcounts.`,
    };
  }
  return { valid: true, total };
}

export function runMarkovSimulation(
  P: number[][],
  v0: number[],
  iterations: number,
  mode: PopulationMode
): SimulationResultsPayload {
  const n = P.length;
  const totalPopulation = v0.reduce((a, b) => a + b, 0);
  const trajectory: number[][] = [v0.map((x) => Number(x))];

  for (let k = 0; k < iterations; k++) {
    const prev = trajectory[k];
    const next: number[] = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let acc = 0;
      for (let j = 0; j < n; j++) {
        acc += P[i][j] * prev[j];
      }
      next[i] = acc;
    }
    trajectory.push(next);
  }

  const normalizedTrajectory = trajectory.map((vec) => {
    const sum = vec.reduce((a, b) => a + b, 0);
    return sum > 0 ? vec.map((v) => v / sum) : vec.map(() => 0);
  });

  const deltas: number[][] = [];
  for (let k = 1; k < trajectory.length; k++) {
    deltas.push(trajectory[k].map((v, i) => v - trajectory[k - 1][i]));
  }

  return {
    mode,
    totalPopulation,
    trajectory,
    normalizedTrajectory,
    deltas,
    finalDistribution: trajectory[trajectory.length - 1],
  };
}

// --- Complex Arithmetic & Linear Algebra Helpers ---

function toComplexVal(val: unknown): ComplexVal {
  if (typeof val === 'number') {
    return { re: Math.abs(val) < 1e-12 ? 0 : val, im: 0 };
  }
  if (val && typeof val === 'object' && 're' in val && 'im' in val) {
    const c = val as { re: number; im: number };
    return {
      re: Math.abs(c.re) < 1e-12 ? 0 : c.re,
      im: Math.abs(c.im) < 1e-12 ? 0 : c.im,
    };
  }
  return { re: Number(val) || 0, im: 0 };
}

function cAdd(a: ComplexVal, b: ComplexVal): ComplexVal {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cSub(a: ComplexVal, b: ComplexVal): ComplexVal {
  return { re: a.re - b.re, im: a.im - b.im };
}

function cMul(a: ComplexVal, b: ComplexVal): ComplexVal {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function cDiv(a: ComplexVal, b: ComplexVal): ComplexVal {
  const denom = b.re * b.re + b.im * b.im;
  if (denom < 1e-24) return { re: 0, im: 0 };
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

function cAbs(a: ComplexVal): number {
  return Math.hypot(a.re, a.im);
}

export function formatComplex(c: ComplexVal, digits = 4): string {
  const re = Math.abs(c.re) < 5e-7 ? 0 : c.re;
  const im = Math.abs(c.im) < 5e-7 ? 0 : c.im;
  if (im === 0) return re.toFixed(digits);
  const sign = im >= 0 ? '+' : '−';
  return `${re.toFixed(digits)} ${sign} ${Math.abs(im).toFixed(digits)}i`;
}

// Compute eigenvalues via complex QR iteration on Hessenberg-reduced matrix (fallback when math.eigs fails on periodic matrices)
function complexQREigenvalues(matrix: number[][]): ComplexVal[] {
  const n = matrix.length;
  // Apply an initial deterministic orthogonal Householder-like mixing so cyclic permutation
  // matrices don't sit on zero diagonal with non-Hessenberg sub-row entries.
  // First convert matrix to upper Hessenberg form via real Householder reflections.
  const H: number[][] = matrix.map((r) => [...r]);
  for (let k = 0; k < n - 2; k++) {
    let normX = 0;
    for (let i = k + 1; i < n; i++) normX += H[i][k] * H[i][k];
    normX = Math.sqrt(normX);
    if (normX < 1e-13) continue;
    const sign = H[k + 1][k] >= 0 ? 1 : -1;
    const u0 = H[k + 1][k] + sign * normX;
    const u = [u0];
    for (let i = k + 2; i < n; i++) u.push(H[i][k]);
    const uNormSq = u.reduce((a, b) => a + b * b, 0);
    if (uNormSq < 1e-24) continue;
    const beta = 2 / uNormSq;

    // Left multiply: H[k+1:n, k:n] -= beta * u * (u^T * H[k+1:n, k:n])
    for (let j = k; j < n; j++) {
      let dot = 0;
      for (let i = 0; i < u.length; i++) dot += u[i] * H[k + 1 + i][j];
      for (let i = 0; i < u.length; i++) H[k + 1 + i][j] -= beta * u[i] * dot;
    }
    // Right multiply: H[0:n, k+1:n] -= beta * (H[0:n, k+1:n] * u) * u^T
    for (let i = 0; i < n; i++) {
      let dot = 0;
      for (let j = 0; j < u.length; j++) dot += H[i][k + 1 + j] * u[j];
      for (let j = 0; j < u.length; j++) H[i][k + 1 + j] -= beta * dot * u[j];
    }
  }

  let A: ComplexVal[][] = H.map((row) => row.map((v) => ({ re: v, im: 0 })));
  const eigenvalues: ComplexVal[] = [];
  let m = n;
  let iter = 0;
  const maxIter = 800 * n;

  while (m > 0 && iter < maxIter) {
    if (m === 1) {
      eigenvalues.push(A[0][0]);
      break;
    }

    // Only deflate when the entire sub-row (cols 0 .. m-2) of row m-1 is negligible
    let rowOffNorm = 0;
    for (let j = 0; j < m - 1; j++) {
      rowOffNorm = Math.max(rowOffNorm, cAbs(A[m - 1][j]));
    }
    const diagNorm = cAbs(A[m - 1][m - 1]) + cAbs(A[m - 2][m - 2]);
    if (rowOffNorm <= 1e-10 * Math.max(1, diagNorm)) {
      eigenvalues.push(A[m - 1][m - 1]);
      m--;
      continue;
    }

    // Bottom-right 2x2 Wilkinson shift
    const a11 = A[m - 2][m - 2];
    const a12 = A[m - 2][m - 1];
    const a21 = A[m - 1][m - 2];
    const a22 = A[m - 1][m - 1];
    const tr = cAdd(a11, a22);
    const det = cSub(cMul(a11, a22), cMul(a12, a21));
    const disc = cSub(cMul(tr, tr), { re: 4 * det.re, im: 4 * det.im });
    const r = cAbs(disc);
    const theta = Math.atan2(disc.im, disc.re);
    const sqrtDisc: ComplexVal = {
      re: Math.sqrt(r) * Math.cos(theta / 2),
      im: Math.sqrt(r) * Math.sin(theta / 2),
    };
    const lam1 = { re: (tr.re + sqrtDisc.re) / 2, im: (tr.im + sqrtDisc.im) / 2 };
    const lam2 = { re: (tr.re - sqrtDisc.re) / 2, im: (tr.im - sqrtDisc.im) / 2 };
    let shift = cAbs(cSub(lam1, a22)) < cAbs(cSub(lam2, a22)) ? lam1 : lam2;

    if ((cAbs(shift) < 1e-12 && iter % 5 === 0) || iter % 30 === 29) {
      shift = { re: shift.re + 0.3713, im: shift.im + 0.5191 };
    }

    const M: ComplexVal[][] = Array.from({ length: m }, (_, i) =>
      Array.from({ length: m }, (_, j) =>
        i === j ? cSub(A[i][j], shift) : { ...A[i][j] }
      )
    );

    const Q: ComplexVal[][] = Array.from({ length: m }, () =>
      Array.from({ length: m }, () => ({ re: 0, im: 0 }))
    );
    const R: ComplexVal[][] = Array.from({ length: m }, () =>
      Array.from({ length: m }, () => ({ re: 0, im: 0 }))
    );

    for (let j = 0; j < m; j++) {
      const v: ComplexVal[] = M.map((row) => ({ ...row[j] }));
      for (let i = 0; i < j; i++) {
        let dot: ComplexVal = { re: 0, im: 0 };
        for (let k = 0; k < m; k++) {
          const conjQ = { re: Q[k][i].re, im: -Q[k][i].im };
          dot = cAdd(dot, cMul(conjQ, v[k]));
        }
        R[i][j] = dot;
        for (let k = 0; k < m; k++) {
          v[k] = cSub(v[k], cMul(dot, Q[k][i]));
        }
      }
      const norm = Math.sqrt(v.reduce((acc, c) => acc + c.re * c.re + c.im * c.im, 0));
      R[j][j] = { re: norm, im: 0 };
      if (norm > 1e-14) {
        for (let k = 0; k < m; k++) {
          Q[k][j] = { re: v[k].re / norm, im: v[k].im / norm };
        }
      } else {
        Q[j][j] = { re: 1, im: 0 };
      }
    }

    const nextA: ComplexVal[][] = Array.from({ length: m }, (_, i) =>
      Array.from({ length: m }, (_, j) => {
        let acc: ComplexVal = { re: 0, im: 0 };
        for (let k = 0; k < m; k++) {
          acc = cAdd(acc, cMul(R[i][k], Q[k][j]));
        }
        return i === j ? cAdd(acc, shift) : acc;
      })
    );
    A = nextA;
    iter++;
  }

  if (m > 0 && eigenvalues.length < n) {
    for (let i = 0; i < m; i++) {
      eigenvalues.push(A[i][i]);
    }
  }

  return eigenvalues.map((ev) => ({
    re: Math.abs(ev.re) < 1e-9 ? 0 : ev.re,
    im: Math.abs(ev.im) < 1e-9 ? 0 : ev.im,
  }));
}

function complexNullspace(P: number[][], lambda: ComplexVal, tol = 1e-6): ComplexVal[][] {
  const n = P.length;
  const A: ComplexVal[][] = P.map((row, i) =>
    row.map((val, j) => (i === j ? cSub({ re: val, im: 0 }, lambda) : { re: val, im: 0 }))
  );

  // RREF in complex arithmetic
  const pivotCols: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < n; c++) {
    let bestRow = r;
    let bestNorm = cAbs(A[r][c]);
    for (let i = r + 1; i < n; i++) {
      const cand = cAbs(A[i][c]);
      if (cand > bestNorm) {
        bestNorm = cand;
        bestRow = i;
      }
    }
    if (bestNorm < tol) continue;
    [A[r], A[bestRow]] = [A[bestRow], A[r]];
    const piv = A[r][c];
    for (let j = c; j < n; j++) {
      A[r][j] = cDiv(A[r][j], piv);
    }
    for (let i = 0; i < n; i++) {
      if (i !== r && cAbs(A[i][c]) > 1e-12) {
        const factor = A[i][c];
        for (let j = c; j < n; j++) {
          A[i][j] = cSub(A[i][j], cMul(factor, A[r][j]));
        }
      }
    }
    pivotCols.push(c);
    r++;
  }

  const freeCols: number[] = [];
  for (let c = 0; c < n; c++) {
    if (!pivotCols.includes(c)) freeCols.push(c);
  }

  const basis: ComplexVal[][] = [];
  for (const fc of freeCols) {
    const vec: ComplexVal[] = Array.from({ length: n }, () => ({ re: 0, im: 0 }));
    vec[fc] = { re: 1, im: 0 };
    for (let idx = 0; idx < pivotCols.length; idx++) {
      const pc = pivotCols[idx];
      vec[pc] = { re: -A[idx][fc].re, im: -A[idx][fc].im };
    }
    // Normalize to unit Euclidean norm
    const norm = Math.sqrt(vec.reduce((acc, v) => acc + v.re * v.re + v.im * v.im, 0));
    if (norm > 1e-12) {
      basis.push(vec.map((v) => ({ re: v.re / norm, im: v.im / norm })));
    }
  }
  return basis;
}

function realNullspace(AInput: number[][], tol = 1e-7): number[][] {
  const n = AInput.length;
  const A = AInput.map((row) => [...row]);
  const pivotCols: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < n; c++) {
    let bestRow = r;
    let bestVal = Math.abs(A[r][c]);
    for (let i = r + 1; i < n; i++) {
      if (Math.abs(A[i][c]) > bestVal) {
        bestVal = Math.abs(A[i][c]);
        bestRow = i;
      }
    }
    if (bestVal < tol) continue;
    [A[r], A[bestRow]] = [A[bestRow], A[r]];
    const piv = A[r][c];
    for (let j = c; j < n; j++) A[r][j] /= piv;
    for (let i = 0; i < n; i++) {
      if (i !== r && Math.abs(A[i][c]) > 1e-12) {
        const factor = A[i][c];
        for (let j = c; j < n; j++) A[i][j] -= factor * A[r][j];
      }
    }
    pivotCols.push(c);
    r++;
  }

  const freeCols: number[] = [];
  for (let c = 0; c < n; c++) {
    if (!pivotCols.includes(c)) freeCols.push(c);
  }

  const basis: number[][] = [];
  for (const fc of freeCols) {
    const vec = Array(n).fill(0);
    vec[fc] = 1;
    for (let idx = 0; idx < pivotCols.length; idx++) {
      vec[pivotCols[idx]] = -A[idx][fc];
    }
    basis.push(vec);
  }
  return basis;
}

export function analyzeEigenvalues(P: number[][]): EigenAnalysisResult {
  const n = P.length;
  let eigenvalues: ComplexVal[] = [];

  try {
    const res = math.eigs(P);
    const vals = Array.isArray(res.values) ? res.values : (res.values as math.Matrix).toArray();
    eigenvalues = vals.map(toComplexVal);
    if (eigenvalues.length !== n) {
      throw new Error('Incomplete eigenvalue set');
    }
  } catch {
    eigenvalues = complexQREigenvalues(P);
  }

  // Sort eigenvalues by modulus descending, then real part descending
  eigenvalues.sort((a, b) => {
    const diff = cAbs(b) - cAbs(a);
    if (Math.abs(diff) > 1e-6) return diff;
    return b.re - a.re;
  });

  // Group near-equal eigenvalues so repeated eigenvalues collect all linearly independent eigenvectors
  const pairs: EigenPair[] = [];
  const processedIndices = new Set<number>();

  for (let i = 0; i < eigenvalues.length; i++) {
    if (processedIndices.has(i)) continue;
    const ev = eigenvalues[i];
    const matchingIdx = [i];
    for (let j = i + 1; j < eigenvalues.length; j++) {
      if (!processedIndices.has(j) && cAbs(cSub(eigenvalues[j], ev)) < 1e-4) {
        matchingIdx.push(j);
      }
    }
    matchingIdx.forEach((idx) => processedIndices.add(idx));

    const basis = complexNullspace(P, ev, 1e-5);
    const mod = cAbs(ev);
    const isComplex = Math.abs(ev.im) > 1e-6;

    if (basis.length === 0) {
      // Fallback: compute inverse iteration / approximate eigenvector
      const looseBasis = complexNullspace(P, ev, 1e-3);
      pairs.push({
        eigenvalue: ev,
        modulus: mod,
        isComplex,
        eigenvector: looseBasis[0] ?? Array.from({ length: n }, (_, k) => ({ re: k === 0 ? 1 : 0, im: 0 })),
      });
    } else {
      for (let b = 0; b < Math.min(basis.length, matchingIdx.length); b++) {
        // Flip eigenvector sign so largest-magnitude component is positive if real
        let vec = basis[b];
        if (!isComplex) {
          const sumRe = vec.reduce((acc, c) => acc + c.re, 0);
          if (sumRe < -1e-6) {
            vec = vec.map((c) => ({ re: -c.re, im: -c.im }));
          }
        }
        pairs.push({
          eigenvalue: eigenvalues[matchingIdx[b]],
          modulus: cAbs(eigenvalues[matchingIdx[b]]),
          isComplex: Math.abs(eigenvalues[matchingIdx[b]].im) > 1e-6,
          eigenvector: vec,
        });
      }
    }
  }

  const dominantEigenvalue = eigenvalues[0] ?? null;
  const nonUnitModuli = eigenvalues
    .filter((ev) => cAbs(cSub(ev, { re: 1, im: 0 })) > 1e-4)
    .map(cAbs)
    .sort((a, b) => b - a);

  const secondModulus = nonUnitModuli.length > 0 ? nonUnitModuli[0] : null;
  const spectralGap = secondModulus !== null ? Math.max(0, 1 - secondModulus) : null;
  const hasComplexEigenvalues = eigenvalues.some((ev) => Math.abs(ev.im) > 1e-5);

  const unitCircleNonOne = eigenvalues.filter(
    (ev) => Math.abs(cAbs(ev) - 1) < 1e-4 && cAbs(cSub(ev, { re: 1, im: 0 })) > 1e-4
  );
  const isPeriodic = unitCircleNonOne.length > 0;
  let periodEstimate = 1;
  if (isPeriodic) {
    // Estimate period from smallest positive phase angle 2π / d
    const angles = unitCircleNonOne
      .map((ev) => Math.abs(Math.atan2(ev.im, ev.re)))
      .filter((a) => a > 1e-4);
    if (angles.length > 0) {
      const minAngle = Math.min(...angles);
      periodEstimate = Math.max(2, Math.round((2 * Math.PI) / minAngle));
    } else {
      periodEstimate = 2;
    }
  }

  const interpretation: string[] = [];
  interpretation.push(
    'Every column-stochastic transition matrix has λ₁ = 1 as a dominant eigenvalue (guaranteed by Perron–Frobenius theorem), representing probability conservation.'
  );
  if (isPeriodic) {
    interpretation.push(
      `Periodic behavior detected: ${unitCircleNonOne.length} additional eigenvalue(s) lie on the unit circle (|λ| = 1, λ ≠ 1), creating cyclic oscillations of approximate period ${periodEstimate}.`
    );
  } else if (secondModulus !== null && secondModulus < 1 - 1e-4) {
    interpretation.push(
      `The subdominant modulus |λ₂| = ${secondModulus.toFixed(4)} < 1 governs convergence speed. Smaller |λ₂| (larger spectral gap ${(1 - secondModulus).toFixed(4)}) means the population reaches equilibrium faster.`
    );
  } else if (secondModulus !== null && Math.abs(secondModulus - 1) <= 1e-4) {
    interpretation.push(
      'Multiple eigenvalues equal λ = 1, indicating reducible or multi-absorbing states where long-term distribution depends on the initial state.'
    );
  }
  if (hasComplexEigenvalues) {
    interpretation.push(
      'Complex conjugate eigenvalues (a ± bi) cause oscillatory or cyclical transitions between states as the system evolves.'
    );
  }

  return {
    eigenvalues,
    pairs,
    dominantEigenvalue,
    secondModulus,
    spectralGap,
    hasComplexEigenvalues,
    isPeriodic,
    periodEstimate,
    interpretation,
  };
}

export function analyzeSteadyState(P: number[][]): SteadyStateResult {
  const n = P.length;
  // Solve (P - I) * pi = 0
  const PMinusI = P.map((row, i) => row.map((v, j) => (i === j ? v - 1 : v)));
  const basis = realNullspace(PMinusI, 1e-7);
  const nullity = basis.length;
  const eigenInfo = analyzeEigenvalues(P);

  // Normalize basis vectors so positive or sum = 1 if non-zero sum
  const normalizedBasis = basis.map((vec) => {
    const sum = vec.reduce((a, b) => a + b, 0);
    if (Math.abs(sum) > 1e-8) {
      const scaled = vec.map((v) => v / sum);
      // Clean tiny floating-point negatives
      return scaled.map((v) => (Math.abs(v) < 1e-9 ? 0 : v));
    }
    return vec;
  });

  if (nullity === 0) {
    return {
      existsUnique: false,
      isPeriodic: eigenInfo.isPeriodic,
      isErgodic: false,
      nullity: 0,
      stationaryVector: null,
      basisVectors: [],
      residualNorm: null,
      sumCheck: null,
      statusLabel: 'Numerical Singularity Warning',
      explanation:
        'Could not isolate an exact nullspace vector for (P − I) within numerical tolerance. Check matrix column sums.',
      convergenceStepsTo1e4: null,
    };
  }

  if (nullity > 1) {
    return {
      existsUnique: false,
      isPeriodic: eigenInfo.isPeriodic,
      isErgodic: false,
      nullity,
      stationaryVector: null,
      basisVectors: normalizedBasis,
      residualNorm: null,
      sumCheck: null,
      statusLabel: 'Non-Unique Steady State (Multiple Equilibrium Subspaces)',
      explanation: `The matrix has geometric multiplicity ${nullity} for λ = 1 (reducible chain or ${nullity} separate closed/absorbing classes). A unique steady state cannot be established because the long-term distribution depends on the initial population v(0).`,
      convergenceStepsTo1e4: null,
    };
  }

  // Unique stationary vector pi exists
  const pi = normalizedBasis[0];
  // Compute residual ||P*pi - pi||_inf
  let residualNorm = 0;
  for (let i = 0; i < n; i++) {
    let pPi = 0;
    for (let j = 0; j < n; j++) pPi += P[i][j] * pi[j];
    residualNorm = Math.max(residualNorm, Math.abs(pPi - pi[i]));
  }
  const sumCheck = pi.reduce((a, b) => a + b, 0);

  if (eigenInfo.isPeriodic) {
    return {
      existsUnique: true,
      isPeriodic: true,
      isErgodic: false,
      nullity: 1,
      stationaryVector: pi,
      basisVectors: normalizedBasis,
      residualNorm,
      sumCheck,
      statusLabel: 'Unique Stationary Vector (Periodic / Oscillating Chain)',
      explanation: `A unique stationary distribution π satisfying Pπ = π exists, but because the chain is periodic (period ≈ ${eigenInfo.periodEstimate}), Pᵏv(0) will oscillate indefinitely rather than converging to π unless v(0) = π.`,
      convergenceStepsTo1e4: null,
    };
  }

  // Estimate steps to converge within 1e-4 from canonical basis worst case
  let maxSteps = 0;
  for (let startCol = 0; startCol < n; startCol++) {
    let v = Array(n).fill(0);
    v[startCol] = 1;
    for (let step = 1; step <= 500; step++) {
      const next = Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) next[i] += P[i][j] * v[j];
      }
      v = next;
      const err = Math.max(...v.map((val, idx) => Math.abs(val - pi[idx])));
      if (err < 1e-4) {
        maxSteps = Math.max(maxSteps, step);
        break;
      }
      if (step === 500) maxSteps = 500;
    }
  }

  return {
    existsUnique: true,
    isPeriodic: false,
    isErgodic: true,
    nullity: 1,
    stationaryVector: pi,
    basisVectors: normalizedBasis,
    residualNorm,
    sumCheck,
    statusLabel: 'Unique Steady State Verified (Convergent Chain)',
    explanation: `Every initial population distribution v(0) converges asymptotically to the unique equilibrium π regardless of starting shares. Convergence within 0.01% tolerance occurs in approximately ${maxSteps} steps.`,
    convergenceStepsTo1e4: maxSteps,
  };
}

function invertComplexMatrix(M: ComplexVal[][]): ComplexVal[][] | null {
  const n = M.length;
  const aug: ComplexVal[][] = M.map((row, i) => [
    ...row.map((c) => ({ ...c })),
    ...Array.from({ length: n }, (_, j) => ({ re: i === j ? 1 : 0, im: 0 })),
  ]);

  for (let col = 0; col < n; col++) {
    let bestRow = col;
    let bestNorm = cAbs(aug[col][col]);
    for (let i = col + 1; i < n; i++) {
      const cand = cAbs(aug[i][col]);
      if (cand > bestNorm) {
        bestNorm = cand;
        bestRow = i;
      }
    }
    if (bestNorm < 1e-8) return null;
    [aug[col], aug[bestRow]] = [aug[bestRow], aug[col]];
    const piv = aug[col][col];
    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] = cDiv(aug[col][j], piv);
    }
    for (let i = 0; i < n; i++) {
      if (i !== col && cAbs(aug[i][col]) > 1e-12) {
        const factor = aug[i][col];
        for (let j = 0; j < 2 * n; j++) {
          aug[i][j] = cSub(aug[i][j], cMul(factor, aug[col][j]));
        }
      }
    }
  }

  return aug.map((row) => row.slice(n));
}

export function analyzeDiagonalization(P: number[][]): DiagonalizationResult {
  const n = P.length;
  const eigen = analyzeEigenvalues(P);
  const independentCount = eigen.pairs.length;

  if (independentCount < n) {
    return {
      isDiagonalizable: false,
      isComplex: eigen.hasComplexEigenvalues,
      matrixSize: n,
      independentEigenvectors: independentCount,
      V: null,
      D: null,
      VInv: null,
      reconstructionError: null,
      explanation: `Not diagonalizable (defective matrix): found only ${independentCount} linearly independent eigenvectors for a ${n}×${n} matrix. At least one repeated eigenvalue has geometric multiplicity strictly less than its algebraic multiplicity.`,
    };
  }

  // Construct V (n x n) with eigenvectors as columns, and D (n x n) diagonal
  const V: ComplexVal[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => eigen.pairs[j].eigenvector[i] ?? { re: 0, im: 0 })
  );
  const D: ComplexVal[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j ? eigen.pairs[i].eigenvalue : { re: 0, im: 0 }
    )
  );

  const VInv = invertComplexMatrix(V);
  if (!VInv) {
    return {
      isDiagonalizable: false,
      isComplex: eigen.hasComplexEigenvalues,
      matrixSize: n,
      independentEigenvectors: independentCount,
      V: null,
      D: null,
      VInv: null,
      reconstructionError: null,
      explanation:
        'Eigenvector matrix V is numerically singular (linearly dependent eigenvectors), so P cannot be factored as V D V⁻¹.',
    };
  }

  // Verify reconstruction P_rec = V * D * VInv
  const VD: ComplexVal[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let acc: ComplexVal = { re: 0, im: 0 };
      for (let k = 0; k < n; k++) acc = cAdd(acc, cMul(V[i][k], D[k][j]));
      return acc;
    })
  );
  const VDVInv: ComplexVal[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let acc: ComplexVal = { re: 0, im: 0 };
      for (let k = 0; k < n; k++) acc = cAdd(acc, cMul(VD[i][k], VInv[k][j]));
      return acc;
    })
  );

  let maxErr = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const err = cAbs(cSub(VDVInv[i][j], { re: P[i][j], im: 0 }));
      if (err > maxErr) maxErr = err;
    }
  }

  if (maxErr > 1e-3) {
    return {
      isDiagonalizable: false,
      isComplex: eigen.hasComplexEigenvalues,
      matrixSize: n,
      independentEigenvectors: independentCount,
      V: null,
      D: null,
      VInv: null,
      reconstructionError: maxErr,
      explanation: `Matrix failed diagonalization verification (reconstruction residual ${maxErr.toExponential(2)}), indicating deficient eigenspace.`,
    };
  }

  return {
    isDiagonalizable: true,
    isComplex: eigen.hasComplexEigenvalues,
    matrixSize: n,
    independentEigenvectors: n,
    V,
    D,
    VInv,
    reconstructionError: maxErr,
    explanation: eigen.hasComplexEigenvalues
      ? `Matrix is diagonalizable over ℂ (complex field): P = V D V⁻¹ with ${n} linearly independent eigenvectors. Future states satisfy v(k) = V Dᵏ V⁻¹ v(0).`
      : `Matrix is diagonalizable over ℝ: P = V D V⁻¹ with ${n} linearly independent real eigenvectors. Any future step can be computed directly in closed form as v(k) = V Dᵏ V⁻¹ v(0).`,
  };
}
