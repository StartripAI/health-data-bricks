/**
 * Health Data Bricks - Fitbit Parser
 *
 * Parses Fitbit API responses and data exports into normalized health records
 */

import {
  HealthRecord,
  HeartRate,
  Steps,
  Distance,
  Calories,
  SleepSession,
  SleepStage,
  Weight,
  Workout,
} from '../../core/types/health-record';

// ============================================================================
// Fitbit API Response Types
// ============================================================================

export interface FitbitHeartRateResponse {
  'activities-heart': Array<{
    dateTime: string;
    value: {
      customHeartRateZones: any[];
      heartRateZones: Array<{
        name: string;
        min: number;
        max: number;
        minutes: number;
        caloriesOut: number;
      }>;
      restingHeartRate?: number;
    };
  }>;
  'activities-heart-intraday'?: {
    dataset: Array<{
      time: string;
      value: number;
    }>;
    datasetInterval: number;
    datasetType: string;
  };
}

export interface FitbitActivityResponse {
  activities: Array<{
    activityId: number;
    activityParentId: number;
    activityParentName: string;
    calories: number;
    description: string;
    distance?: number;
    duration: number;
    hasActiveZoneMinutes: boolean;
    hasStartTime: boolean;
    isFavorite: boolean;
    lastModified: string;
    logId: number;
    name: string;
    startDate: string;
    startTime: string;
    steps?: number;
  }>;
  summary: {
    activeScore: number;
    activityCalories: number;
    caloriesBMR: number;
    caloriesOut: number;
    distances: Array<{ activity: string; distance: number }>;
    fairlyActiveMinutes: number;
    lightlyActiveMinutes: number;
    marginalCalories: number;
    sedentaryMinutes: number;
    steps: number;
    veryActiveMinutes: number;
  };
}

export interface FitbitSleepResponse {
  sleep: Array<{
    dateOfSleep: string;
    duration: number;
    efficiency: number;
    endTime: string;
    isMainSleep: boolean;
    levels: {
      data: Array<{
        dateTime: string;
        level: 'wake' | 'light' | 'deep' | 'rem' | 'restless' | 'awake' | 'asleep';
        seconds: number;
      }>;
      summary: {
        deep?: { count: number; minutes: number; thirtyDayAvgMinutes: number };
        light?: { count: number; minutes: number; thirtyDayAvgMinutes: number };
        rem?: { count: number; minutes: number; thirtyDayAvgMinutes: number };
        wake?: { count: number; minutes: number; thirtyDayAvgMinutes: number };
      };
    };
    logId: number;
    minutesAfterWakeup: number;
    minutesAsleep: number;
    minutesAwake: number;
    minutesToFallAsleep: number;
    startTime: string;
    timeInBed: number;
    type: 'classic' | 'stages';
  }>;
  summary: {
    stages?: {
      deep: number;
      light: number;
      rem: number;
      wake: number;
    };
    totalMinutesAsleep: number;
    totalSleepRecords: number;
    totalTimeInBed: number;
  };
}

export interface FitbitWeightResponse {
  weight: Array<{
    bmi: number;
    date: string;
    fat?: number;
    logId: number;
    source: string;
    time: string;
    weight: number;
  }>;
}

// ============================================================================
// Fitbit Parser Class
// ============================================================================

export class FitbitParser {
  private timezone: string;

  constructor(timezone: string = 'UTC') {
    this.timezone = timezone;
  }

  /**
   * Parse heart rate data
   */
  parseHeartRate(response: FitbitHeartRateResponse): HeartRate[] {
    const records: HeartRate[] = [];

    // Parse intraday data if available
    if (response['activities-heart-intraday']?.dataset) {
      const date = response['activities-heart'][0]?.dateTime;
      if (date) {
        for (const point of response['activities-heart-intraday'].dataset) {
          records.push({
            type: 'heart_rate',
            value: point.value,
            unit: 'bpm',
            timestamp: {
              datetime: `${date}T${point.time}`,
              timezone: this.timezone,
              source: 'device',
            },
            source: this.getSource(),
            context: 'unknown',
          });
        }
      }
    }

    // Parse resting heart rate
    for (const day of response['activities-heart']) {
      if (day.value.restingHeartRate) {
        records.push({
          type: 'heart_rate',
          value: day.value.restingHeartRate,
          unit: 'bpm',
          timestamp: {
            datetime: `${day.dateTime}T00:00:00`,
            timezone: this.timezone,
            source: 'device',
          },
          source: this.getSource(),
          context: 'resting',
        });
      }
    }

    return records;
  }

  /**
   * Parse activity summary
   */
  parseActivity(response: FitbitActivityResponse, date: string): HealthRecord[] {
    const records: HealthRecord[] = [];

    // Steps
    if (response.summary.steps > 0) {
      records.push({
        type: 'steps',
        value: response.summary.steps,
        unit: 'count',
        startTime: {
          datetime: `${date}T00:00:00`,
          timezone: this.timezone,
          source: 'device',
        },
        endTime: {
          datetime: `${date}T23:59:59`,
          timezone: this.timezone,
          source: 'device',
        },
        source: this.getSource(),
      });
    }

    // Distance
    const totalDistance = response.summary.distances.find(d => d.activity === 'total');
    if (totalDistance && totalDistance.distance > 0) {
      records.push({
        type: 'distance',
        value: totalDistance.distance * 1000, // km to meters
        unit: 'meters',
        startTime: {
          datetime: `${date}T00:00:00`,
          timezone: this.timezone,
          source: 'device',
        },
        endTime: {
          datetime: `${date}T23:59:59`,
          timezone: this.timezone,
          source: 'device',
        },
        source: this.getSource(),
      });
    }

    // Calories
    if (response.summary.caloriesOut > 0) {
      records.push({
        type: 'calories',
        value: response.summary.caloriesOut,
        unit: 'kcal',
        startTime: {
          datetime: `${date}T00:00:00`,
          timezone: this.timezone,
          source: 'device',
        },
        endTime: {
          datetime: `${date}T23:59:59`,
          timezone: this.timezone,
          source: 'device',
        },
        source: this.getSource(),
        calorieType: 'total',
      });

      // Active calories
      if (response.summary.activityCalories > 0) {
        records.push({
          type: 'calories',
          value: response.summary.activityCalories,
          unit: 'kcal',
          startTime: {
            datetime: `${date}T00:00:00`,
            timezone: this.timezone,
            source: 'device',
          },
          endTime: {
            datetime: `${date}T23:59:59`,
            timezone: this.timezone,
            source: 'device',
          },
          source: this.getSource(),
          calorieType: 'active',
        });
      }
    }

    return records;
  }

  /**
   * Parse workout/activity logs
   */
  parseWorkouts(response: FitbitActivityResponse): Workout[] {
    return response.activities.map(activity => ({
      type: 'workout',
      activityType: activity.name.toLowerCase().replace(/\s+/g, '_'),
      startTime: {
        datetime: `${activity.startDate}T${activity.startTime}`,
        timezone: this.timezone,
        source: 'device',
      },
      endTime: {
        datetime: this.calculateEndTime(activity.startDate, activity.startTime, activity.duration),
        timezone: this.timezone,
        source: 'device',
      },
      duration: activity.duration / 1000, // ms to seconds
      calories: activity.calories,
      distance: activity.distance ? activity.distance * 1000 : undefined, // km to meters
      distanceUnit: 'meters',
      source: this.getSource(),
      metadata: {
        fitbitLogId: activity.logId,
        activityId: activity.activityId,
      },
    }));
  }

  /**
   * Parse sleep data
   */
  parseSleep(response: FitbitSleepResponse): SleepSession[] {
    return response.sleep
      .filter(sleep => sleep.isMainSleep)
      .map(sleep => {
        const stages: SleepStage[] = sleep.levels.data.map(stage => ({
          stage: this.mapSleepStage(stage.level),
          startTime: {
            datetime: stage.dateTime,
            timezone: this.timezone,
            source: 'device',
          },
          endTime: {
            datetime: this.addSeconds(stage.dateTime, stage.seconds),
            timezone: this.timezone,
            source: 'device',
          },
          duration: stage.seconds,
        }));

        return {
          type: 'sleep' as const,
          startTime: {
            datetime: sleep.startTime,
            timezone: this.timezone,
            source: 'device' as const,
          },
          endTime: {
            datetime: sleep.endTime,
            timezone: this.timezone,
            source: 'device' as const,
          },
          duration: sleep.duration / 1000, // ms to seconds
          stages,
          efficiency: sleep.efficiency,
          awakenings: stages.filter(s => s.stage === 'awake').length,
          source: this.getSource(),
          quality: this.calculateSleepQuality(sleep.efficiency),
        };
      });
  }

  /**
   * Parse weight data
   */
  parseWeight(response: FitbitWeightResponse): Weight[] {
    return response.weight.map(entry => ({
      type: 'weight',
      value: entry.weight,
      unit: 'kg',
      timestamp: {
        datetime: `${entry.date}T${entry.time}`,
        timezone: this.timezone,
        source: 'device',
      },
      source: this.getSource(),
    }));
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getSource() {
    return {
      id: 'fitbit',
      name: 'Fitbit',
      type: 'wearable' as const,
      manufacturer: 'Fitbit',
    };
  }

  private mapSleepStage(level: string): SleepStage['stage'] {
    const mapping: Record<string, SleepStage['stage']> = {
      'wake': 'awake',
      'awake': 'awake',
      'restless': 'awake',
      'light': 'light',
      'asleep': 'light',
      'deep': 'deep',
      'rem': 'rem',
    };
    return mapping[level] || 'unknown';
  }

  private calculateSleepQuality(efficiency: number): SleepSession['quality'] {
    if (efficiency >= 90) return 'excellent';
    if (efficiency >= 80) return 'good';
    if (efficiency >= 70) return 'fair';
    return 'poor';
  }

  private calculateEndTime(date: string, time: string, durationMs: number): string {
    const start = new Date(`${date}T${time}`);
    return new Date(start.getTime() + durationMs).toISOString();
  }

  private addSeconds(datetime: string, seconds: number): string {
    const date = new Date(datetime);
    return new Date(date.getTime() + seconds * 1000).toISOString();
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function parseFitbitHeartRate(response: FitbitHeartRateResponse, timezone?: string): HeartRate[] {
  return new FitbitParser(timezone).parseHeartRate(response);
}

export function parseFitbitActivity(response: FitbitActivityResponse, date: string, timezone?: string): HealthRecord[] {
  return new FitbitParser(timezone).parseActivity(response, date);
}

export function parseFitbitSleep(response: FitbitSleepResponse, timezone?: string): SleepSession[] {
  return new FitbitParser(timezone).parseSleep(response);
}

export function parseFitbitWeight(response: FitbitWeightResponse, timezone?: string): Weight[] {
  return new FitbitParser(timezone).parseWeight(response);
}
