/**
 * Health Data Bricks - Garmin Parser
 *
 * Parses Garmin Connect API responses and FIT file exports
 */

import {
  HealthRecord,
  HeartRate,
  Steps,
  Distance,
  Calories,
  SleepSession,
  SleepStage,
  Workout,
  HRV,
  BloodOxygen,
  RespiratoryRate,
} from '../../core/types/health-record';

// ============================================================================
// Garmin API Response Types
// ============================================================================

export interface GarminDailySummary {
  calendarDate: string;
  startTimeInSeconds: number;
  startTimeOffsetInSeconds: number;
  activityType: string;
  durationInSeconds: number;
  steps: number;
  distanceInMeters: number;
  activeTimeInSeconds: number;
  activeKilocalories: number;
  bmrKilocalories: number;
  consumedCalories: number;
  moderateIntensityDurationInSeconds: number;
  vigorousIntensityDurationInSeconds: number;
  floorsClimbed: number;
  minHeartRateInBeatsPerMinute: number;
  maxHeartRateInBeatsPerMinute: number;
  averageHeartRateInBeatsPerMinute: number;
  restingHeartRateInBeatsPerMinute: number;
  averageStressLevel: number;
  maxStressLevel: number;
  stressDurationInSeconds: number;
  restStressDurationInSeconds: number;
  activityStressDurationInSeconds: number;
  lowStressDurationInSeconds: number;
  mediumStressDurationInSeconds: number;
  highStressDurationInSeconds: number;
}

export interface GarminHeartRateData {
  calendarDate: string;
  startTimeInSeconds: number;
  endTimeInSeconds: number;
  timeOffsetHeartRateSamples: Record<string, number>;
}

export interface GarminSleepData {
  calendarDate: string;
  startTimeInSeconds: number;
  startTimeOffsetInSeconds: number;
  durationInSeconds: number;
  unmeasurableSleepInSeconds: number;
  deepSleepDurationInSeconds: number;
  lightSleepDurationInSeconds: number;
  remSleepInSeconds: number;
  awakeDurationInSeconds: number;
  sleepLevelsMap: {
    deep: Array<{ startTimeInSeconds: number; endTimeInSeconds: number }>;
    light: Array<{ startTimeInSeconds: number; endTimeInSeconds: number }>;
    rem: Array<{ startTimeInSeconds: number; endTimeInSeconds: number }>;
    awake: Array<{ startTimeInSeconds: number; endTimeInSeconds: number }>;
  };
  validation: string;
  timeOffsetSleepRespiration?: Record<string, number>;
  timeOffsetSleepSpo2?: Record<string, number>;
  overallSleepScore: {
    value: number;
    qualifierKey: string;
  };
  sleepScores: {
    totalDuration: { value: number; qualifierKey: string };
    stress: { value: number; qualifierKey: string };
    awakeCount: { value: number; qualifierKey: string };
    overall: { value: number; qualifierKey: string };
    remPercentage: { value: number; qualifierKey: string };
    restlessness: { value: number; qualifierKey: string };
    lightPercentage: { value: number; qualifierKey: string };
    deepPercentage: { value: number; qualifierKey: string };
  };
}

export interface GarminActivity {
  activityId: number;
  activityName: string;
  startTimeLocal: string;
  startTimeGMT: string;
  activityType: {
    typeId: number;
    typeKey: string;
    parentTypeId: number;
  };
  distance: number;
  duration: number;
  elapsedDuration: number;
  movingDuration: number;
  elevationGain: number;
  elevationLoss: number;
  averageSpeed: number;
  maxSpeed: number;
  calories: number;
  averageHR: number;
  maxHR: number;
  steps: number;
  avgStrideLength: number;
  averageRunningCadenceInStepsPerMinute: number;
  maxRunningCadenceInStepsPerMinute: number;
  sportTypeId: number;
}

export interface GarminHRVData {
  calendarDate: string;
  startTimeInSeconds: number;
  hrvValues: Array<{
    hrvValue: number;
    readingTimeGMT: string;
    readingTimeLocal: string;
  }>;
  lastNightAvg: number;
  lastNight5MinHigh: number;
  baseline: {
    lowUpper: number;
    balancedLow: number;
    balancedUpper: number;
  };
  status: string;
}

export interface GarminPulseOxData {
  calendarDate: string;
  startTimeGMT: string;
  endTimeGMT: string;
  startTimeLocal: string;
  endTimeLocal: string;
  averageSpO2: number;
  lowestSpO2: number;
  latestSpO2: number;
  latestSpO2ReadingTimeGMT: string;
  timeOffsetSpO2Values: Record<string, number>;
}

// ============================================================================
// Garmin Parser Class
// ============================================================================

export class GarminParser {
  private timezone: string;

  constructor(timezone: string = 'UTC') {
    this.timezone = timezone;
  }

  /**
   * Parse daily summary data
   */
  parseDailySummary(summary: GarminDailySummary): HealthRecord[] {
    const records: HealthRecord[] = [];
    const date = summary.calendarDate;

    // Steps
    if (summary.steps > 0) {
      records.push({
        type: 'steps',
        value: summary.steps,
        unit: 'count',
        startTime: { datetime: `${date}T00:00:00`, timezone: this.timezone, source: 'device' },
        endTime: { datetime: `${date}T23:59:59`, timezone: this.timezone, source: 'device' },
        source: this.getSource(),
      });
    }

    // Distance
    if (summary.distanceInMeters > 0) {
      records.push({
        type: 'distance',
        value: summary.distanceInMeters,
        unit: 'meters',
        startTime: { datetime: `${date}T00:00:00`, timezone: this.timezone, source: 'device' },
        endTime: { datetime: `${date}T23:59:59`, timezone: this.timezone, source: 'device' },
        source: this.getSource(),
      });
    }

    // Calories (total)
    const totalCalories = summary.activeKilocalories + summary.bmrKilocalories;
    if (totalCalories > 0) {
      records.push({
        type: 'calories',
        value: totalCalories,
        unit: 'kcal',
        startTime: { datetime: `${date}T00:00:00`, timezone: this.timezone, source: 'device' },
        endTime: { datetime: `${date}T23:59:59`, timezone: this.timezone, source: 'device' },
        source: this.getSource(),
        calorieType: 'total',
      });
    }

    // Resting heart rate
    if (summary.restingHeartRateInBeatsPerMinute > 0) {
      records.push({
        type: 'heart_rate',
        value: summary.restingHeartRateInBeatsPerMinute,
        unit: 'bpm',
        timestamp: { datetime: `${date}T00:00:00`, timezone: this.timezone, source: 'device' },
        source: this.getSource(),
        context: 'resting',
      });
    }

    return records;
  }

  /**
   * Parse heart rate time series
   */
  parseHeartRate(data: GarminHeartRateData): HeartRate[] {
    const records: HeartRate[] = [];
    const baseTime = data.startTimeInSeconds * 1000;

    for (const [offset, value] of Object.entries(data.timeOffsetHeartRateSamples)) {
      const timestamp = new Date(baseTime + parseInt(offset) * 1000);
      records.push({
        type: 'heart_rate',
        value,
        unit: 'bpm',
        timestamp: {
          datetime: timestamp.toISOString(),
          timezone: this.timezone,
          source: 'device',
        },
        source: this.getSource(),
        context: 'unknown',
      });
    }

    return records;
  }

  /**
   * Parse sleep data
   */
  parseSleep(data: GarminSleepData): SleepSession {
    const startTime = new Date(data.startTimeInSeconds * 1000);
    const endTime = new Date((data.startTimeInSeconds + data.durationInSeconds) * 1000);

    const stages: SleepStage[] = [];

    // Deep sleep
    for (const period of data.sleepLevelsMap.deep || []) {
      stages.push({
        stage: 'deep',
        startTime: { datetime: new Date(period.startTimeInSeconds * 1000).toISOString(), source: 'device' },
        endTime: { datetime: new Date(period.endTimeInSeconds * 1000).toISOString(), source: 'device' },
        duration: period.endTimeInSeconds - period.startTimeInSeconds,
      });
    }

    // Light sleep
    for (const period of data.sleepLevelsMap.light || []) {
      stages.push({
        stage: 'light',
        startTime: { datetime: new Date(period.startTimeInSeconds * 1000).toISOString(), source: 'device' },
        endTime: { datetime: new Date(period.endTimeInSeconds * 1000).toISOString(), source: 'device' },
        duration: period.endTimeInSeconds - period.startTimeInSeconds,
      });
    }

    // REM sleep
    for (const period of data.sleepLevelsMap.rem || []) {
      stages.push({
        stage: 'rem',
        startTime: { datetime: new Date(period.startTimeInSeconds * 1000).toISOString(), source: 'device' },
        endTime: { datetime: new Date(period.endTimeInSeconds * 1000).toISOString(), source: 'device' },
        duration: period.endTimeInSeconds - period.startTimeInSeconds,
      });
    }

    // Awake periods
    for (const period of data.sleepLevelsMap.awake || []) {
      stages.push({
        stage: 'awake',
        startTime: { datetime: new Date(period.startTimeInSeconds * 1000).toISOString(), source: 'device' },
        endTime: { datetime: new Date(period.endTimeInSeconds * 1000).toISOString(), source: 'device' },
        duration: period.endTimeInSeconds - period.startTimeInSeconds,
      });
    }

    // Sort stages by start time
    stages.sort((a, b) =>
      new Date(a.startTime.datetime).getTime() - new Date(b.startTime.datetime).getTime()
    );

    return {
      type: 'sleep',
      startTime: { datetime: startTime.toISOString(), timezone: this.timezone, source: 'device' },
      endTime: { datetime: endTime.toISOString(), timezone: this.timezone, source: 'device' },
      duration: data.durationInSeconds,
      stages,
      efficiency: Math.round(((data.durationInSeconds - data.awakeDurationInSeconds) / data.durationInSeconds) * 100),
      awakenings: (data.sleepLevelsMap.awake || []).length,
      source: this.getSource(),
      quality: this.mapSleepQuality(data.overallSleepScore?.qualifierKey),
    };
  }

  /**
   * Parse activity/workout data
   */
  parseActivity(activity: GarminActivity): Workout {
    return {
      type: 'workout',
      activityType: activity.activityType.typeKey.toLowerCase(),
      startTime: {
        datetime: activity.startTimeGMT,
        source: 'device',
      },
      endTime: {
        datetime: new Date(new Date(activity.startTimeGMT).getTime() + activity.duration).toISOString(),
        source: 'device',
      },
      duration: activity.duration / 1000, // ms to seconds
      calories: activity.calories,
      distance: activity.distance,
      distanceUnit: 'meters',
      avgHeartRate: activity.averageHR || undefined,
      maxHeartRate: activity.maxHR || undefined,
      source: this.getSource(),
      metadata: {
        garminActivityId: activity.activityId,
        elevationGain: activity.elevationGain,
        elevationLoss: activity.elevationLoss,
        averageSpeed: activity.averageSpeed,
        maxSpeed: activity.maxSpeed,
      },
    };
  }

  /**
   * Parse HRV data
   */
  parseHRV(data: GarminHRVData): HRV[] {
    return data.hrvValues.map(hrv => ({
      type: 'hrv',
      sdnn: hrv.hrvValue,
      unit: 'ms',
      timestamp: {
        datetime: hrv.readingTimeGMT,
        timezone: this.timezone,
        source: 'device',
      },
      source: this.getSource(),
    }));
  }

  /**
   * Parse Pulse Ox data
   */
  parsePulseOx(data: GarminPulseOxData): BloodOxygen[] {
    const records: BloodOxygen[] = [];

    // Parse time series data
    for (const [offset, value] of Object.entries(data.timeOffsetSpO2Values)) {
      const timestamp = new Date(new Date(data.startTimeGMT).getTime() + parseInt(offset) * 1000);
      if (value > 0) {
        records.push({
          type: 'blood_oxygen',
          value,
          unit: '%',
          timestamp: {
            datetime: timestamp.toISOString(),
            timezone: this.timezone,
            source: 'device',
          },
          source: this.getSource(),
          measurementType: 'continuous',
        });
      }
    }

    return records;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getSource() {
    return {
      id: 'garmin',
      name: 'Garmin',
      type: 'wearable' as const,
      manufacturer: 'Garmin',
    };
  }

  private mapSleepQuality(qualifierKey?: string): SleepSession['quality'] {
    const mapping: Record<string, SleepSession['quality']> = {
      'EXCELLENT': 'excellent',
      'GOOD': 'good',
      'FAIR': 'fair',
      'POOR': 'poor',
    };
    return qualifierKey ? (mapping[qualifierKey] || 'unknown') : 'unknown';
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function parseGarminDailySummary(summary: GarminDailySummary, timezone?: string): HealthRecord[] {
  return new GarminParser(timezone).parseDailySummary(summary);
}

export function parseGarminSleep(data: GarminSleepData, timezone?: string): SleepSession {
  return new GarminParser(timezone).parseSleep(data);
}

export function parseGarminActivity(activity: GarminActivity, timezone?: string): Workout {
  return new GarminParser(timezone).parseActivity(activity);
}

export function parseGarminHRV(data: GarminHRVData, timezone?: string): HRV[] {
  return new GarminParser(timezone).parseHRV(data);
}
