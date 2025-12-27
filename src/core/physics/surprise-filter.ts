/**
 * Health Data Bricks - Surprise-Based Filter
 *
 * Implements the Free Energy Principle for intelligent data filtering.
 * Only stores "surprising" health data that deviates from predictions.
 *
 * Physics: Surprise(x) = -log P(x|context)
 * Decision: Keep if Surprise(x) > adaptive_threshold
 */

import { HealthRecord } from '../types/health-record';

// ============================================================================
// Adaptive Threshold (EMA-based)
// ============================================================================

export class AdaptiveThreshold {
  private mean: number;
  private variance: number;
  private initialized: boolean = false;

  constructor(
    private alpha: number = 0.1,  // EMA decay
    private k: number = 2.0,       // Standard deviations
    private initial: number = 1.0
  ) {
    this.mean = initial;
    this.variance = 1.0;
  }

  update(surprise: number): number {
    if (!this.initialized) {
      this.mean = surprise;
      this.variance = 0;
      this.initialized = true;
    } else {
      const delta = surprise - this.mean;
      this.mean = this.alpha * surprise + (1 - this.alpha) * this.mean;
      this.variance = this.alpha * delta * delta + (1 - this.alpha) * this.variance;
    }
    return this.get();
  }

  get(): number {
    return this.mean + this.k * Math.sqrt(this.variance);
  }

  reset(): void {
    this.initialized = false;
    this.mean = this.initial;
    this.variance = 1.0;
  }
}

// ============================================================================
// Online Statistics Tracker
// ============================================================================

export class OnlineStats {
  private count: number = 0;
  private mean: number = 0;
  private m2: number = 0;  // Sum of squared differences

  update(value: number): void {
    this.count++;
    const delta = value - this.mean;
    this.mean += delta / this.count;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2;
  }

  getMean(): number {
    return this.mean;
  }

  getVariance(): number {
    return this.count > 1 ? this.m2 / (this.count - 1) : 0;
  }

  getStdDev(): number {
    return Math.sqrt(this.getVariance());
  }

  getCount(): number {
    return this.count;
  }
}

// ============================================================================
// Predictive Model (Simple Exponential Smoothing)
// ============================================================================

export class ExponentialPredictor {
  private level: number | null = null;
  private trend: number = 0;

  constructor(
    private alpha: number = 0.3,  // Level smoothing
    private beta: number = 0.1    // Trend smoothing
  ) {}

  predict(): number | null {
    if (this.level === null) return null;
    return this.level + this.trend;
  }

  update(value: number): number {
    if (this.level === null) {
      this.level = value;
      this.trend = 0;
      return 0;
    }

    const prediction = this.level + this.trend;
    const error = value - prediction;

    // Holt's linear method
    const prevLevel = this.level;
    this.level = this.alpha * value + (1 - this.alpha) * (this.level + this.trend);
    this.trend = this.beta * (this.level - prevLevel) + (1 - this.beta) * this.trend;

    return Math.abs(error);
  }
}

// ============================================================================
// Surprise Calculator
// ============================================================================

export interface SurpriseResult {
  surprise: number;
  threshold: number;
  keep: boolean;
  prediction: number | null;
  zscore: number;
}

export class SurpriseCalculator {
  private predictor: ExponentialPredictor;
  private threshold: AdaptiveThreshold;
  private stats: OnlineStats;
  private errorStats: OnlineStats;

  constructor(
    alpha: number = 0.3,
    thresholdK: number = 2.0
  ) {
    this.predictor = new ExponentialPredictor(alpha);
    this.threshold = new AdaptiveThreshold(0.1, thresholdK);
    this.stats = new OnlineStats();
    this.errorStats = new OnlineStats();
  }

  calculate(value: number): SurpriseResult {
    // Get prediction
    const prediction = this.predictor.predict();

    // Calculate surprise (prediction error)
    const error = this.predictor.update(value);

    // Update error statistics
    this.errorStats.update(error);
    this.stats.update(value);

    // Calculate z-score of error
    const errorMean = this.errorStats.getMean();
    const errorStd = this.errorStats.getStdDev() || 1;
    const zscore = (error - errorMean) / errorStd;

    // Surprise = normalized prediction error
    // Using Gaussian negative log-likelihood approximation
    const surprise = 0.5 * zscore * zscore;

    // Update adaptive threshold
    const currentThreshold = this.threshold.update(surprise);

    return {
      surprise,
      threshold: currentThreshold,
      keep: surprise > currentThreshold,
      prediction,
      zscore,
    };
  }

  reset(): void {
    this.predictor = new ExponentialPredictor();
    this.threshold.reset();
    this.stats = new OnlineStats();
    this.errorStats = new OnlineStats();
  }
}

// ============================================================================
// Multi-Metric Surprise Filter
// ============================================================================

export interface FilterConfig {
  thresholdK: number;
  minSamples: number;  // Warmup period
  metrics: string[];
}

export interface FilterResult {
  keep: boolean;
  totalSurprise: number;
  metricSurprises: Record<string, SurpriseResult>;
  reason: string;
}

export class SurpriseFilter {
  private calculators: Map<string, SurpriseCalculator> = new Map();
  private sampleCount: number = 0;
  private config: FilterConfig;

  constructor(config: Partial<FilterConfig> = {}) {
    this.config = {
      thresholdK: 2.0,
      minSamples: 10,
      metrics: ['heart_rate', 'steps', 'sleep_duration', 'calories'],
      ...config,
    };

    // Initialize calculators for each metric
    for (const metric of this.config.metrics) {
      this.calculators.set(metric, new SurpriseCalculator(0.3, this.config.thresholdK));
    }
  }

  /**
   * Filter a health record based on surprise
   */
  filter(record: HealthRecord): FilterResult {
    this.sampleCount++;

    // During warmup, keep all data
    if (this.sampleCount < this.config.minSamples) {
      return {
        keep: true,
        totalSurprise: 0,
        metricSurprises: {},
        reason: 'warmup',
      };
    }

    // Extract value based on record type
    const value = this.extractValue(record);
    if (value === null) {
      return {
        keep: true,
        totalSurprise: 0,
        metricSurprises: {},
        reason: 'unsupported_type',
      };
    }

    // Get or create calculator for this type
    let calculator = this.calculators.get(record.type);
    if (!calculator) {
      calculator = new SurpriseCalculator(0.3, this.config.thresholdK);
      this.calculators.set(record.type, calculator);
    }

    // Calculate surprise
    const result = calculator.calculate(value);

    return {
      keep: result.keep,
      totalSurprise: result.surprise,
      metricSurprises: { [record.type]: result },
      reason: result.keep ? 'surprising' : 'expected',
    };
  }

  /**
   * Batch filter with aggregated statistics
   */
  filterBatch(records: HealthRecord[]): {
    kept: HealthRecord[];
    dropped: HealthRecord[];
    stats: {
      total: number;
      kept: number;
      dropped: number;
      filterRate: number;
      avgSurprise: number;
    };
  } {
    const kept: HealthRecord[] = [];
    const dropped: HealthRecord[] = [];
    let totalSurprise = 0;

    for (const record of records) {
      const result = this.filter(record);
      totalSurprise += result.totalSurprise;

      if (result.keep) {
        kept.push(record);
      } else {
        dropped.push(record);
      }
    }

    return {
      kept,
      dropped,
      stats: {
        total: records.length,
        kept: kept.length,
        dropped: dropped.length,
        filterRate: records.length > 0 ? dropped.length / records.length : 0,
        avgSurprise: records.length > 0 ? totalSurprise / records.length : 0,
      },
    };
  }

  private extractValue(record: HealthRecord): number | null {
    switch (record.type) {
      case 'heart_rate':
        return (record as any).value;
      case 'steps':
        return (record as any).value;
      case 'calories':
        return (record as any).value;
      case 'sleep':
        return (record as any).duration;
      case 'weight':
        return (record as any).value;
      case 'blood_pressure':
        return (record as any).systolic; // Could also track diastolic
      case 'blood_oxygen':
        return (record as any).value;
      default:
        return null;
    }
  }

  reset(): void {
    this.calculators.clear();
    this.sampleCount = 0;
    for (const metric of this.config.metrics) {
      this.calculators.set(metric, new SurpriseCalculator(0.3, this.config.thresholdK));
    }
  }
}

// ============================================================================
// Export convenience functions
// ============================================================================

export function createSurpriseFilter(config?: Partial<FilterConfig>): SurpriseFilter {
  return new SurpriseFilter(config);
}
