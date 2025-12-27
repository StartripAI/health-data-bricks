/**
 * Health Data Bricks - Data Normalizer
 *
 * Normalizes and validates health records from various sources
 */

import { HealthRecord, HealthRecordSchema } from '../types/health-record';
import { normalizeTemperature, normalizeWeight, normalizeDistance } from './unit-converter';

// ============================================================================
// Normalization Configuration
// ============================================================================

export interface NormalizationConfig {
  temperature: {
    unit: 'celsius' | 'fahrenheit';
  };
  weight: {
    unit: 'kg' | 'lbs';
  };
  height: {
    unit: 'cm' | 'inches';
  };
  distance: {
    unit: 'meters' | 'kilometers' | 'miles';
  };
  timezone: string;
}

export const DEFAULT_CONFIG: NormalizationConfig = {
  temperature: { unit: 'celsius' },
  weight: { unit: 'kg' },
  height: { unit: 'cm' },
  distance: { unit: 'meters' },
  timezone: 'UTC',
};

// ============================================================================
// Data Normalizer Class
// ============================================================================

export class DataNormalizer {
  private config: NormalizationConfig;

  constructor(config: Partial<NormalizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Normalize a single health record
   */
  normalize(record: HealthRecord): HealthRecord {
    // Validate the record first
    const validated = HealthRecordSchema.parse(record);

    // Apply type-specific normalization
    switch (validated.type) {
      case 'body_temperature':
        return this.normalizeTemperature(validated);
      case 'weight':
        return this.normalizeWeight(validated);
      case 'height':
        return this.normalizeHeight(validated);
      case 'distance':
        return this.normalizeDistanceRecord(validated);
      case 'steps':
      case 'calories':
      case 'workout':
        return this.normalizeActivityTimes(validated);
      default:
        return validated;
    }
  }

  /**
   * Normalize an array of health records
   */
  normalizeAll(records: HealthRecord[]): HealthRecord[] {
    return records.map(r => this.normalize(r));
  }

  /**
   * Validate and filter valid records
   */
  validateAndFilter(records: unknown[]): HealthRecord[] {
    const valid: HealthRecord[] = [];
    const errors: { index: number; error: string }[] = [];

    records.forEach((record, index) => {
      try {
        const validated = HealthRecordSchema.parse(record);
        valid.push(this.normalize(validated));
      } catch (e) {
        errors.push({ index, error: String(e) });
      }
    });

    if (errors.length > 0) {
      console.warn(`Filtered ${errors.length} invalid records`);
    }

    return valid;
  }

  // ============================================================================
  // Private Normalization Methods
  // ============================================================================

  private normalizeTemperature(record: HealthRecord & { type: 'body_temperature' }): HealthRecord {
    if (record.unit === this.config.temperature.unit) {
      return record;
    }

    return {
      ...record,
      value: normalizeTemperature(record.value, record.unit, this.config.temperature.unit),
      unit: this.config.temperature.unit,
    };
  }

  private normalizeWeight(record: HealthRecord & { type: 'weight' }): HealthRecord {
    if (record.unit === this.config.weight.unit) {
      return record;
    }

    return {
      ...record,
      value: normalizeWeight(record.value, record.unit, this.config.weight.unit),
      unit: this.config.weight.unit,
    };
  }

  private normalizeHeight(record: HealthRecord & { type: 'height' }): HealthRecord {
    if (record.unit === this.config.height.unit) {
      return record;
    }

    const value = record.unit === 'cm'
      ? record.value / 2.54  // cm to inches
      : record.value * 2.54; // inches to cm

    return {
      ...record,
      value,
      unit: this.config.height.unit,
    };
  }

  private normalizeDistanceRecord(record: HealthRecord & { type: 'distance' }): HealthRecord {
    if (record.unit === this.config.distance.unit) {
      return record;
    }

    return {
      ...record,
      value: normalizeDistance(record.value, record.unit, this.config.distance.unit),
      unit: this.config.distance.unit,
    };
  }

  private normalizeActivityTimes(record: HealthRecord): HealthRecord {
    // Ensure timezone is set
    if ('startTime' in record && !record.startTime.timezone) {
      record = {
        ...record,
        startTime: { ...record.startTime, timezone: this.config.timezone },
      };
    }
    if ('endTime' in record && !record.endTime.timezone) {
      record = {
        ...record,
        endTime: { ...record.endTime, timezone: this.config.timezone },
      };
    }
    return record;
  }
}

// ============================================================================
// Outlier Detection
// ============================================================================

export interface OutlierConfig {
  heartRate: { min: number; max: number };
  bloodPressureSystolic: { min: number; max: number };
  bloodPressureDiastolic: { min: number; max: number };
  bloodOxygen: { min: number; max: number };
  temperature: { min: number; max: number }; // in celsius
  steps: { maxPerHour: number };
}

export const DEFAULT_OUTLIER_CONFIG: OutlierConfig = {
  heartRate: { min: 30, max: 220 },
  bloodPressureSystolic: { min: 70, max: 200 },
  bloodPressureDiastolic: { min: 40, max: 130 },
  bloodOxygen: { min: 70, max: 100 },
  temperature: { min: 34, max: 42 },
  steps: { maxPerHour: 15000 },
};

export function detectOutliers(
  records: HealthRecord[],
  config: OutlierConfig = DEFAULT_OUTLIER_CONFIG
): { valid: HealthRecord[]; outliers: HealthRecord[] } {
  const valid: HealthRecord[] = [];
  const outliers: HealthRecord[] = [];

  for (const record of records) {
    let isOutlier = false;

    switch (record.type) {
      case 'heart_rate':
        isOutlier = record.value < config.heartRate.min || record.value > config.heartRate.max;
        break;
      case 'blood_pressure':
        isOutlier =
          record.systolic < config.bloodPressureSystolic.min ||
          record.systolic > config.bloodPressureSystolic.max ||
          record.diastolic < config.bloodPressureDiastolic.min ||
          record.diastolic > config.bloodPressureDiastolic.max;
        break;
      case 'blood_oxygen':
        isOutlier = record.value < config.bloodOxygen.min || record.value > config.bloodOxygen.max;
        break;
      case 'body_temperature':
        const tempInCelsius = record.unit === 'fahrenheit'
          ? (record.value - 32) * 5/9
          : record.value;
        isOutlier = tempInCelsius < config.temperature.min || tempInCelsius > config.temperature.max;
        break;
    }

    if (isOutlier) {
      outliers.push(record);
    } else {
      valid.push(record);
    }
  }

  return { valid, outliers };
}

// ============================================================================
// Deduplication
// ============================================================================

export function deduplicateRecords(
  records: HealthRecord[],
  windowMs: number = 60000 // 1 minute window
): HealthRecord[] {
  const seen = new Map<string, HealthRecord>();

  for (const record of records) {
    // Create a key based on type and approximate timestamp
    const timestamp = 'timestamp' in record
      ? new Date(record.timestamp.datetime).getTime()
      : 'startTime' in record
        ? new Date(record.startTime.datetime).getTime()
        : 0;

    const windowKey = Math.floor(timestamp / windowMs);
    const key = `${record.type}-${windowKey}`;

    // Keep the first record in each window
    if (!seen.has(key)) {
      seen.set(key, record);
    }
  }

  return Array.from(seen.values());
}
