/**
 * Health Data Bricks - Continuous Dynamics Engine
 *
 * Implements Closed-form Continuous (CfC) dynamics for health state estimation.
 * Handles non-uniform time sampling (critical for wearable data streams).
 *
 * Physics: h(t) = sigmoid(-dt/τ) * h(0) + (1 - sigmoid(-dt/τ)) * Equilibrium
 * Key Property: Stable for ANY dt, handles gaps in data correctly
 */

// ============================================================================
// Configuration
// ============================================================================

export interface CfCConfig {
  stateDim: number;        // Dimension of hidden state
  tauMin: number;          // Fastest reaction time (seconds)
  tauMax: number;          // Memory retention time (seconds)
  decayDefault: number;    // Default decay when no input
}

export const DEFAULT_CFC_CONFIG: CfCConfig = {
  stateDim: 32,
  tauMin: 0.05,      // 50ms - fastest physiological response
  tauMax: 86400,     // 24 hours - circadian rhythm
  decayDefault: 0.99,
};

// ============================================================================
// Vector Math Utilities
// ============================================================================

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function vectorAdd(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

function vectorScale(a: number[], s: number): number[] {
  return a.map(v => v * s);
}

function vectorMultiply(a: number[], b: number[]): number[] {
  return a.map((v, i) => v * b[i]);
}

function vectorSubtract(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - b[i]);
}

function zeros(n: number): number[] {
  return new Array(n).fill(0);
}

// ============================================================================
// Closed-form Continuous (CfC) Cell
// ============================================================================

export class CfCCell {
  private config: CfCConfig;
  private state: number[];
  private tau: number[];           // Per-dimension time constants
  private equilibrium: number[];   // Attractor states
  private lastTimestamp: number | null = null;

  constructor(config: Partial<CfCConfig> = {}) {
    this.config = { ...DEFAULT_CFC_CONFIG, ...config };
    this.state = zeros(this.config.stateDim);
    this.tau = new Array(this.config.stateDim).fill((this.config.tauMin + this.config.tauMax) / 2);
    this.equilibrium = zeros(this.config.stateDim);
  }

  /**
   * Update state with new observation and time delta
   *
   * The key physics:
   * - If dt is small: state ≈ previous state (continuity)
   * - If dt is large: state → equilibrium (relaxation)
   */
  step(observation: number[], timestamp: number): number[] {
    // Calculate dt
    let dt: number;
    if (this.lastTimestamp === null) {
      dt = 0.1; // Default for first observation
    } else {
      dt = Math.max(timestamp - this.lastTimestamp, 1e-4);
    }
    this.lastTimestamp = timestamp;

    // Update equilibrium based on observation
    // Equilibrium is where the system "wants" to be given current input
    this.updateEquilibrium(observation);

    // Update time constants based on observation variability
    this.updateTau(observation);

    // Closed-form solution to LTC ODE
    // decay[i] = exp(-dt / tau[i])
    const decay = this.tau.map(t => Math.exp(-dt / t));

    // h_new = h_old * decay + equilibrium * (1 - decay)
    const newState = vectorAdd(
      vectorMultiply(this.state, decay),
      vectorMultiply(this.equilibrium, decay.map(d => 1 - d))
    );

    this.state = newState;
    return this.state;
  }

  /**
   * Predict future state without new observation
   * Useful for filling gaps or forecasting
   */
  predict(futureTimestamp: number): number[] {
    if (this.lastTimestamp === null) {
      return zeros(this.config.stateDim);
    }

    const dt = Math.max(futureTimestamp - this.lastTimestamp, 0);
    const decay = this.tau.map(t => Math.exp(-dt / t));

    return vectorAdd(
      vectorMultiply(this.state, decay),
      vectorMultiply(this.equilibrium, decay.map(d => 1 - d))
    );
  }

  /**
   * Get current state
   */
  getState(): number[] {
    return [...this.state];
  }

  /**
   * Get time constants
   */
  getTau(): number[] {
    return [...this.tau];
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.state = zeros(this.config.stateDim);
    this.tau = new Array(this.config.stateDim).fill((this.config.tauMin + this.config.tauMax) / 2);
    this.equilibrium = zeros(this.config.stateDim);
    this.lastTimestamp = null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private updateEquilibrium(observation: number[]): void {
    // Simple: equilibrium follows observation with smoothing
    const alpha = 0.3;
    for (let i = 0; i < Math.min(observation.length, this.config.stateDim); i++) {
      this.equilibrium[i] = alpha * observation[i] + (1 - alpha) * this.equilibrium[i];
    }
  }

  private updateTau(observation: number[]): void {
    // Tau adapts based on how much observation differs from state
    // Large difference → faster adaptation (smaller tau)
    // Small difference → maintain memory (larger tau)
    for (let i = 0; i < Math.min(observation.length, this.config.stateDim); i++) {
      const diff = Math.abs(observation[i] - this.state[i]);
      const normalizedDiff = Math.tanh(diff); // 0 to 1

      // Map to tau range: high diff → low tau, low diff → high tau
      const targetTau = this.config.tauMax - normalizedDiff * (this.config.tauMax - this.config.tauMin);

      // Smooth update
      this.tau[i] = 0.1 * targetTau + 0.9 * this.tau[i];
    }
  }
}

// ============================================================================
// Health State Estimator
// ============================================================================

export interface HealthStateConfig {
  dimensions: {
    name: string;
    tauMin: number;
    tauMax: number;
  }[];
}

export const DEFAULT_HEALTH_STATE_CONFIG: HealthStateConfig = {
  dimensions: [
    { name: 'cardiovascular', tauMin: 60, tauMax: 3600 },        // 1min to 1hr
    { name: 'activity', tauMin: 300, tauMax: 86400 },            // 5min to 24hr
    { name: 'sleep', tauMin: 3600, tauMax: 604800 },             // 1hr to 1 week
    { name: 'stress', tauMin: 60, tauMax: 7200 },                // 1min to 2hr
    { name: 'energy', tauMin: 1800, tauMax: 86400 },             // 30min to 24hr
    { name: 'recovery', tauMin: 3600, tauMax: 259200 },          // 1hr to 3 days
    { name: 'circadian', tauMin: 43200, tauMax: 172800 },        // 12hr to 48hr
    { name: 'metabolic', tauMin: 1800, tauMax: 28800 },          // 30min to 8hr
  ],
};

export interface HealthState {
  timestamp: number;
  dimensions: Record<string, number>;
  confidence: Record<string, number>;
  timeSinceUpdate: number;
}

export class HealthStateEstimator {
  private cells: Map<string, CfCCell> = new Map();
  private config: HealthStateConfig;
  private lastUpdateTime: number | null = null;

  constructor(config: Partial<HealthStateConfig> = {}) {
    this.config = { ...DEFAULT_HEALTH_STATE_CONFIG, ...config };

    // Initialize a CfC cell for each dimension
    for (const dim of this.config.dimensions) {
      this.cells.set(dim.name, new CfCCell({
        stateDim: 4, // Internal representation per dimension
        tauMin: dim.tauMin,
        tauMax: dim.tauMax,
      }));
    }
  }

  /**
   * Update health state with new observations
   */
  update(observations: Record<string, number>, timestamp: number): HealthState {
    this.lastUpdateTime = timestamp;

    const dimensions: Record<string, number> = {};
    const confidence: Record<string, number> = {};

    for (const dim of this.config.dimensions) {
      const cell = this.cells.get(dim.name)!;

      // Create observation vector (expand scalar to vector)
      const obsValue = observations[dim.name] ?? 0;
      const obsVector = [obsValue, obsValue * 0.5, obsValue * 0.25, obsValue * 0.125];

      // Update cell
      const state = cell.step(obsVector, timestamp);

      // Aggregate to scalar (weighted sum)
      dimensions[dim.name] = state[0] * 0.5 + state[1] * 0.3 + state[2] * 0.15 + state[3] * 0.05;

      // Confidence based on how recent/stable the updates are
      const tau = cell.getTau();
      const avgTau = tau.reduce((a, b) => a + b, 0) / tau.length;
      confidence[dim.name] = Math.exp(-0.1 / avgTau); // Higher tau = more confidence in stability
    }

    return {
      timestamp,
      dimensions,
      confidence,
      timeSinceUpdate: 0,
    };
  }

  /**
   * Get predicted state at future time
   */
  predict(futureTimestamp: number): HealthState {
    const dimensions: Record<string, number> = {};
    const confidence: Record<string, number> = {};

    for (const dim of this.config.dimensions) {
      const cell = this.cells.get(dim.name)!;
      const state = cell.predict(futureTimestamp);

      dimensions[dim.name] = state[0] * 0.5 + state[1] * 0.3 + state[2] * 0.15 + state[3] * 0.05;

      // Confidence decays with prediction horizon
      const dt = this.lastUpdateTime ? futureTimestamp - this.lastUpdateTime : 0;
      const tau = cell.getTau();
      const avgTau = tau.reduce((a, b) => a + b, 0) / tau.length;
      confidence[dim.name] = Math.exp(-dt / avgTau);
    }

    return {
      timestamp: futureTimestamp,
      dimensions,
      confidence,
      timeSinceUpdate: this.lastUpdateTime ? futureTimestamp - this.lastUpdateTime : Infinity,
    };
  }

  /**
   * Get current state
   */
  getCurrentState(): HealthState | null {
    if (this.lastUpdateTime === null) return null;
    return this.predict(this.lastUpdateTime);
  }

  /**
   * Reset all cells
   */
  reset(): void {
    for (const cell of this.cells.values()) {
      cell.reset();
    }
    this.lastUpdateTime = null;
  }
}

// ============================================================================
// Export convenience functions
// ============================================================================

export function createHealthStateEstimator(config?: Partial<HealthStateConfig>): HealthStateEstimator {
  return new HealthStateEstimator(config);
}

export function createCfCCell(config?: Partial<CfCConfig>): CfCCell {
  return new CfCCell(config);
}
