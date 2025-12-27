/**
 * Health Data Bricks - Apple Health Parser
 *
 * Parses Apple Health Export XML data into normalized health records
 */

import { XMLParser } from 'fast-xml-parser';
import {
  HealthRecord,
  HeartRate,
  Steps,
  Distance,
  Calories,
  SleepSession,
  SleepStage,
  Weight,
  Height,
  Workout,
  BloodOxygen,
  HRV,
} from '../../core/types/health-record';

// ============================================================================
// Apple Health Type Mappings
// ============================================================================

const APPLE_HEALTH_TYPES = {
  'HKQuantityTypeIdentifierHeartRate': 'heart_rate',
  'HKQuantityTypeIdentifierStepCount': 'steps',
  'HKQuantityTypeIdentifierDistanceWalkingRunning': 'distance',
  'HKQuantityTypeIdentifierActiveEnergyBurned': 'calories',
  'HKQuantityTypeIdentifierBasalEnergyBurned': 'calories_resting',
  'HKQuantityTypeIdentifierBodyMass': 'weight',
  'HKQuantityTypeIdentifierHeight': 'height',
  'HKQuantityTypeIdentifierOxygenSaturation': 'blood_oxygen',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': 'hrv',
  'HKQuantityTypeIdentifierRestingHeartRate': 'resting_heart_rate',
  'HKQuantityTypeIdentifierWalkingHeartRateAverage': 'walking_heart_rate',
  'HKQuantityTypeIdentifierRespiratoryRate': 'respiratory_rate',
  'HKQuantityTypeIdentifierBodyTemperature': 'body_temperature',
  'HKQuantityTypeIdentifierBloodPressureSystolic': 'blood_pressure_systolic',
  'HKQuantityTypeIdentifierBloodPressureDiastolic': 'blood_pressure_diastolic',
  'HKCategoryTypeIdentifierSleepAnalysis': 'sleep',
} as const;

const SLEEP_STAGE_MAPPING: Record<string, SleepStage['stage']> = {
  'HKCategoryValueSleepAnalysisInBed': 'light',
  'HKCategoryValueSleepAnalysisAsleep': 'light',
  'HKCategoryValueSleepAnalysisAsleepCore': 'light',
  'HKCategoryValueSleepAnalysisAsleepDeep': 'deep',
  'HKCategoryValueSleepAnalysisAsleepREM': 'rem',
  'HKCategoryValueSleepAnalysisAwake': 'awake',
};

// ============================================================================
// Parser Interface
// ============================================================================

export interface AppleHealthExport {
  records: HealthRecord[];
  workouts: Workout[];
  metadata: {
    exportDate: string;
    recordCount: number;
    workoutCount: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
}

export interface AppleHealthParserOptions {
  includeWorkouts?: boolean;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  types?: string[];
}

// ============================================================================
// Apple Health Parser Class
// ============================================================================

export class AppleHealthParser {
  private parser: XMLParser;
  private options: AppleHealthParserOptions;

  constructor(options: AppleHealthParserOptions = {}) {
    this.options = {
      includeWorkouts: true,
      ...options,
    };

    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true,
    });
  }

  /**
   * Parse Apple Health export XML string
   */
  parse(xmlContent: string): AppleHealthExport {
    const parsed = this.parser.parse(xmlContent);
    const healthData = parsed.HealthData;

    if (!healthData) {
      throw new Error('Invalid Apple Health export: missing HealthData element');
    }

    const records = this.parseRecords(healthData.Record || []);
    const workouts = this.options.includeWorkouts
      ? this.parseWorkouts(healthData.Workout || [])
      : [];

    // Calculate date range
    const allDates = [
      ...records.map(r => 'timestamp' in r ? r.timestamp.datetime : r.startTime.datetime),
      ...workouts.map(w => w.startTime.datetime),
    ].filter(Boolean).sort();

    return {
      records,
      workouts,
      metadata: {
        exportDate: healthData.ExportDate?.value || new Date().toISOString(),
        recordCount: records.length,
        workoutCount: workouts.length,
        dateRange: {
          start: allDates[0] || '',
          end: allDates[allDates.length - 1] || '',
        },
      },
    };
  }

  /**
   * Parse individual records
   */
  private parseRecords(records: any[]): HealthRecord[] {
    if (!Array.isArray(records)) {
      records = [records];
    }

    const parsed: HealthRecord[] = [];

    for (const record of records) {
      const healthRecord = this.parseRecord(record);
      if (healthRecord && this.isInDateRange(healthRecord)) {
        parsed.push(healthRecord);
      }
    }

    return parsed;
  }

  private parseRecord(record: any): HealthRecord | null {
    const type = APPLE_HEALTH_TYPES[record.type as keyof typeof APPLE_HEALTH_TYPES];
    if (!type) return null;

    if (this.options.types && !this.options.types.includes(type)) {
      return null;
    }

    const source = {
      id: record.sourceName || 'apple_health',
      name: record.sourceName || 'Apple Health',
      type: 'wearable' as const,
      manufacturer: 'Apple',
      model: record.sourceVersion,
    };

    const startDate = record.startDate || record.creationDate;
    const endDate = record.endDate || startDate;

    switch (type) {
      case 'heart_rate':
        return {
          type: 'heart_rate',
          value: parseFloat(record.value),
          unit: 'bpm',
          timestamp: { datetime: startDate, source: 'device' },
          source,
          context: this.inferHeartRateContext(record),
          confidence: 1,
        };

      case 'steps':
        return {
          type: 'steps',
          value: parseInt(record.value, 10),
          unit: 'count',
          startTime: { datetime: startDate, source: 'device' },
          endTime: { datetime: endDate, source: 'device' },
          source,
        };

      case 'distance':
        return {
          type: 'distance',
          value: parseFloat(record.value) * 1000, // Apple uses km, convert to meters
          unit: 'meters',
          startTime: { datetime: startDate, source: 'device' },
          endTime: { datetime: endDate, source: 'device' },
          source,
        };

      case 'calories':
      case 'calories_resting':
        return {
          type: 'calories',
          value: parseFloat(record.value),
          unit: 'kcal',
          startTime: { datetime: startDate, source: 'device' },
          endTime: { datetime: endDate, source: 'device' },
          source,
          calorieType: type === 'calories_resting' ? 'resting' : 'active',
        };

      case 'weight':
        return {
          type: 'weight',
          value: parseFloat(record.value),
          unit: record.unit === 'lb' ? 'lbs' : 'kg',
          timestamp: { datetime: startDate, source: 'device' },
          source,
        };

      case 'height':
        return {
          type: 'height',
          value: parseFloat(record.value) * 100, // meters to cm
          unit: 'cm',
          timestamp: { datetime: startDate, source: 'device' },
          source,
        };

      case 'blood_oxygen':
        return {
          type: 'blood_oxygen',
          value: parseFloat(record.value) * 100, // decimal to percentage
          unit: '%',
          timestamp: { datetime: startDate, source: 'device' },
          source,
          measurementType: 'spot',
        };

      case 'hrv':
        return {
          type: 'hrv',
          sdnn: parseFloat(record.value),
          unit: 'ms',
          timestamp: { datetime: startDate, source: 'device' },
          source,
        };

      default:
        return null;
    }
  }

  /**
   * Parse workout records
   */
  private parseWorkouts(workouts: any[]): Workout[] {
    if (!Array.isArray(workouts)) {
      workouts = [workouts];
    }

    return workouts.map(workout => this.parseWorkout(workout)).filter(Boolean) as Workout[];
  }

  private parseWorkout(workout: any): Workout | null {
    if (!workout.workoutActivityType) return null;

    const startDate = workout.startDate;
    const endDate = workout.endDate;
    const duration = workout.duration ? parseFloat(workout.duration) * 60 : 0; // minutes to seconds

    return {
      type: 'workout',
      activityType: this.normalizeWorkoutType(workout.workoutActivityType),
      startTime: { datetime: startDate, source: 'device' },
      endTime: { datetime: endDate, source: 'device' },
      duration,
      calories: workout.totalEnergyBurned ? parseFloat(workout.totalEnergyBurned) : undefined,
      distance: workout.totalDistance ? parseFloat(workout.totalDistance) * 1000 : undefined,
      distanceUnit: 'meters',
      source: {
        id: workout.sourceName || 'apple_health',
        name: workout.sourceName || 'Apple Health',
        type: 'wearable',
        manufacturer: 'Apple',
      },
    };
  }

  /**
   * Parse sleep data
   */
  parseSleep(records: any[]): SleepSession[] {
    const sleepRecords = records.filter(
      r => r.type === 'HKCategoryTypeIdentifierSleepAnalysis'
    );

    if (sleepRecords.length === 0) return [];

    // Group by date (sleep sessions)
    const sessionMap = new Map<string, any[]>();

    for (const record of sleepRecords) {
      const date = record.startDate.split('T')[0];
      if (!sessionMap.has(date)) {
        sessionMap.set(date, []);
      }
      sessionMap.get(date)!.push(record);
    }

    const sessions: SleepSession[] = [];

    for (const [date, records] of sessionMap) {
      const sortedRecords = records.sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );

      const startTime = sortedRecords[0].startDate;
      const endTime = sortedRecords[sortedRecords.length - 1].endDate;
      const duration = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000;

      const stages: SleepStage[] = sortedRecords.map(record => ({
        stage: SLEEP_STAGE_MAPPING[record.value] || 'unknown',
        startTime: { datetime: record.startDate, source: 'device' as const },
        endTime: { datetime: record.endDate, source: 'device' as const },
        duration: (new Date(record.endDate).getTime() - new Date(record.startDate).getTime()) / 1000,
      }));

      sessions.push({
        type: 'sleep',
        startTime: { datetime: startTime, source: 'device' },
        endTime: { datetime: endTime, source: 'device' },
        duration,
        stages,
        awakenings: stages.filter(s => s.stage === 'awake').length,
        source: {
          id: 'apple_health',
          name: 'Apple Health',
          type: 'wearable',
          manufacturer: 'Apple',
        },
      });
    }

    return sessions;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private inferHeartRateContext(record: any): HeartRate['context'] {
    const metadata = record.MetadataEntry || [];
    for (const entry of Array.isArray(metadata) ? metadata : [metadata]) {
      if (entry.key === 'HKMetadataKeyHeartRateMotionContext') {
        switch (entry.value) {
          case 0: return 'resting';
          case 1: return 'active';
          default: return 'unknown';
        }
      }
    }
    return 'unknown';
  }

  private normalizeWorkoutType(appleType: string): string {
    const typeMap: Record<string, string> = {
      'HKWorkoutActivityTypeRunning': 'running',
      'HKWorkoutActivityTypeWalking': 'walking',
      'HKWorkoutActivityTypeCycling': 'cycling',
      'HKWorkoutActivityTypeSwimming': 'swimming',
      'HKWorkoutActivityTypeYoga': 'yoga',
      'HKWorkoutActivityTypeStrengthTraining': 'strength_training',
      'HKWorkoutActivityTypeHIIT': 'hiit',
      'HKWorkoutActivityTypeElliptical': 'elliptical',
      'HKWorkoutActivityTypeRowing': 'rowing',
      'HKWorkoutActivityTypeStairClimbing': 'stair_climbing',
    };

    return typeMap[appleType] || appleType.replace('HKWorkoutActivityType', '').toLowerCase();
  }

  private isInDateRange(record: HealthRecord): boolean {
    if (!this.options.dateRange) return true;

    const { start, end } = this.options.dateRange;
    const recordDate = 'timestamp' in record
      ? new Date(record.timestamp.datetime)
      : new Date(record.startTime.datetime);

    if (start && recordDate < start) return false;
    if (end && recordDate > end) return false;

    return true;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function parseAppleHealthExport(
  xmlContent: string,
  options?: AppleHealthParserOptions
): AppleHealthExport {
  const parser = new AppleHealthParser(options);
  return parser.parse(xmlContent);
}
