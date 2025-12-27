/**
 * Health Data Bricks - Time-based Aggregator
 *
 * Aggregates health data over time periods (hourly, daily, weekly, monthly)
 */

import { HealthRecord, HeartRate, Steps, Calories, SleepSession } from '../../core/types/health-record';

// ============================================================================
// Aggregation Types
// ============================================================================

export type AggregationPeriod = 'hour' | 'day' | 'week' | 'month';

export interface AggregatedMetric {
  period: string; // ISO date or period identifier
  periodStart: string;
  periodEnd: string;
  count: number;
  sum?: number;
  avg?: number;
  min?: number;
  max?: number;
  stdDev?: number;
}

export interface DailyHealthSummary {
  date: string;
  vitals: {
    avgHeartRate?: number;
    minHeartRate?: number;
    maxHeartRate?: number;
    restingHeartRate?: number;
    avgBloodOxygen?: number;
  };
  activity: {
    totalSteps: number;
    totalDistance: number; // meters
    totalCalories: number;
    activeMinutes: number;
    workouts: number;
  };
  sleep?: {
    duration: number; // seconds
    efficiency?: number;
    deepSleepMinutes: number;
    remSleepMinutes: number;
    lightSleepMinutes: number;
    awakenings: number;
  };
  scores: {
    activityScore: number; // 0-100
    sleepScore: number; // 0-100
    readinessScore: number; // 0-100
  };
}

export interface WeeklyTrend {
  weekStart: string;
  weekEnd: string;
  avgDailySteps: number;
  avgSleepDuration: number;
  avgHeartRate: number;
  totalWorkouts: number;
  comparedToLastWeek: {
    steps: number; // percentage change
    sleep: number;
    heartRate: number;
  };
}

// ============================================================================
// Time Aggregator Class
// ============================================================================

export class TimeAggregator {
  /**
   * Aggregate numeric records by time period
   */
  aggregateByPeriod(
    records: HealthRecord[],
    period: AggregationPeriod,
    extractValue: (record: HealthRecord) => number | null
  ): AggregatedMetric[] {
    // Group records by period
    const groups = new Map<string, number[]>();

    for (const record of records) {
      const timestamp = this.getRecordTimestamp(record);
      if (!timestamp) continue;

      const periodKey = this.getPeriodKey(timestamp, period);
      const value = extractValue(record);
      if (value === null) continue;

      if (!groups.has(periodKey)) {
        groups.set(periodKey, []);
      }
      groups.get(periodKey)!.push(value);
    }

    // Calculate aggregates
    const results: AggregatedMetric[] = [];

    for (const [periodKey, values] of groups) {
      const { start, end } = this.getPeriodBounds(periodKey, period);
      results.push({
        period: periodKey,
        periodStart: start,
        periodEnd: end,
        count: values.length,
        sum: this.sum(values),
        avg: this.avg(values),
        min: Math.min(...values),
        max: Math.max(...values),
        stdDev: this.stdDev(values),
      });
    }

    return results.sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  }

  /**
   * Generate daily health summary
   */
  generateDailySummary(records: HealthRecord[], date: string): DailyHealthSummary {
    const dayRecords = records.filter(r => {
      const ts = this.getRecordTimestamp(r);
      return ts && ts.startsWith(date);
    });

    // Extract records by type
    const heartRates = dayRecords.filter((r): r is HeartRate => r.type === 'heart_rate');
    const steps = dayRecords.filter((r): r is Steps => r.type === 'steps');
    const calories = dayRecords.filter((r): r is Calories => r.type === 'calories');
    const sleepSessions = dayRecords.filter((r): r is SleepSession => r.type === 'sleep');
    const workouts = dayRecords.filter(r => r.type === 'workout');

    // Calculate vitals
    const hrValues = heartRates.map(r => r.value);
    const restingHR = heartRates.filter(r => r.context === 'resting').map(r => r.value);

    // Calculate activity
    const totalSteps = steps.reduce((sum, r) => sum + r.value, 0);
    const totalCalories = calories.reduce((sum, r) => sum + r.value, 0);
    const totalDistance = dayRecords
      .filter(r => r.type === 'distance')
      .reduce((sum, r) => sum + (r as any).value, 0);

    // Calculate sleep (use the main sleep session of the day)
    const mainSleep = sleepSessions.find(s => s.duration > 3600); // > 1 hour
    let sleepData;
    if (mainSleep) {
      const deepMinutes = mainSleep.stages
        ?.filter(s => s.stage === 'deep')
        .reduce((sum, s) => sum + s.duration / 60, 0) || 0;
      const remMinutes = mainSleep.stages
        ?.filter(s => s.stage === 'rem')
        .reduce((sum, s) => sum + s.duration / 60, 0) || 0;
      const lightMinutes = mainSleep.stages
        ?.filter(s => s.stage === 'light')
        .reduce((sum, s) => sum + s.duration / 60, 0) || 0;

      sleepData = {
        duration: mainSleep.duration,
        efficiency: mainSleep.efficiency,
        deepSleepMinutes: Math.round(deepMinutes),
        remSleepMinutes: Math.round(remMinutes),
        lightSleepMinutes: Math.round(lightMinutes),
        awakenings: mainSleep.awakenings || 0,
      };
    }

    // Calculate scores
    const activityScore = this.calculateActivityScore(totalSteps, totalCalories, workouts.length);
    const sleepScore = sleepData ? this.calculateSleepScore(sleepData) : 0;
    const readinessScore = this.calculateReadinessScore(activityScore, sleepScore, hrValues);

    return {
      date,
      vitals: {
        avgHeartRate: hrValues.length > 0 ? this.avg(hrValues) : undefined,
        minHeartRate: hrValues.length > 0 ? Math.min(...hrValues) : undefined,
        maxHeartRate: hrValues.length > 0 ? Math.max(...hrValues) : undefined,
        restingHeartRate: restingHR.length > 0 ? this.avg(restingHR) : undefined,
      },
      activity: {
        totalSteps,
        totalDistance,
        totalCalories,
        activeMinutes: this.calculateActiveMinutes(dayRecords),
        workouts: workouts.length,
      },
      sleep: sleepData,
      scores: {
        activityScore,
        sleepScore,
        readinessScore,
      },
    };
  }

  /**
   * Calculate weekly trends
   */
  calculateWeeklyTrend(
    currentWeekRecords: HealthRecord[],
    previousWeekRecords: HealthRecord[]
  ): WeeklyTrend {
    const currentSummaries = this.getUniqueDates(currentWeekRecords).map(
      date => this.generateDailySummary(currentWeekRecords, date)
    );
    const previousSummaries = this.getUniqueDates(previousWeekRecords).map(
      date => this.generateDailySummary(previousWeekRecords, date)
    );

    const avgStepsCurrent = this.avg(currentSummaries.map(s => s.activity.totalSteps));
    const avgStepsPrevious = this.avg(previousSummaries.map(s => s.activity.totalSteps)) || 1;

    const avgSleepCurrent = this.avg(
      currentSummaries.filter(s => s.sleep).map(s => s.sleep!.duration)
    );
    const avgSleepPrevious = this.avg(
      previousSummaries.filter(s => s.sleep).map(s => s.sleep!.duration)
    ) || 1;

    const avgHRCurrent = this.avg(
      currentSummaries.filter(s => s.vitals.avgHeartRate).map(s => s.vitals.avgHeartRate!)
    );
    const avgHRPrevious = this.avg(
      previousSummaries.filter(s => s.vitals.avgHeartRate).map(s => s.vitals.avgHeartRate!)
    ) || 1;

    const dates = this.getUniqueDates(currentWeekRecords).sort();

    return {
      weekStart: dates[0] || '',
      weekEnd: dates[dates.length - 1] || '',
      avgDailySteps: Math.round(avgStepsCurrent),
      avgSleepDuration: Math.round(avgSleepCurrent),
      avgHeartRate: Math.round(avgHRCurrent),
      totalWorkouts: currentSummaries.reduce((sum, s) => sum + s.activity.workouts, 0),
      comparedToLastWeek: {
        steps: Math.round(((avgStepsCurrent - avgStepsPrevious) / avgStepsPrevious) * 100),
        sleep: Math.round(((avgSleepCurrent - avgSleepPrevious) / avgSleepPrevious) * 100),
        heartRate: Math.round(((avgHRCurrent - avgHRPrevious) / avgHRPrevious) * 100),
      },
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getRecordTimestamp(record: HealthRecord): string | null {
    if ('timestamp' in record) {
      return record.timestamp.datetime;
    }
    if ('startTime' in record) {
      return record.startTime.datetime;
    }
    return null;
  }

  private getPeriodKey(datetime: string, period: AggregationPeriod): string {
    const date = new Date(datetime);

    switch (period) {
      case 'hour':
        return `${date.toISOString().slice(0, 13)}:00:00`;
      case 'day':
        return date.toISOString().slice(0, 10);
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().slice(0, 10);
      case 'month':
        return date.toISOString().slice(0, 7);
    }
  }

  private getPeriodBounds(periodKey: string, period: AggregationPeriod): { start: string; end: string } {
    const start = new Date(periodKey);
    const end = new Date(periodKey);

    switch (period) {
      case 'hour':
        end.setHours(end.getHours() + 1);
        break;
      case 'day':
        end.setDate(end.getDate() + 1);
        break;
      case 'week':
        end.setDate(end.getDate() + 7);
        break;
      case 'month':
        end.setMonth(end.getMonth() + 1);
        break;
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  private getUniqueDates(records: HealthRecord[]): string[] {
    const dates = new Set<string>();
    for (const record of records) {
      const ts = this.getRecordTimestamp(record);
      if (ts) dates.add(ts.slice(0, 10));
    }
    return Array.from(dates);
  }

  private sum(values: number[]): number {
    return values.reduce((a, b) => a + b, 0);
  }

  private avg(values: number[]): number {
    if (values.length === 0) return 0;
    return this.sum(values) / values.length;
  }

  private stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = this.avg(values);
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(this.avg(squareDiffs));
  }

  private calculateActivityScore(steps: number, calories: number, workouts: number): number {
    // Simple scoring based on typical goals
    const stepsScore = Math.min(steps / 10000, 1) * 40;
    const caloriesScore = Math.min(calories / 2000, 1) * 30;
    const workoutScore = Math.min(workouts, 2) * 15;
    return Math.round(stepsScore + caloriesScore + workoutScore);
  }

  private calculateSleepScore(sleep: NonNullable<DailyHealthSummary['sleep']>): number {
    const durationScore = Math.min(sleep.duration / (8 * 3600), 1) * 40; // 8 hours ideal
    const efficiencyScore = (sleep.efficiency || 85) / 100 * 30;
    const deepScore = Math.min(sleep.deepSleepMinutes / 90, 1) * 20; // 90 min ideal
    const awakeningPenalty = Math.max(0, 10 - sleep.awakenings * 2);
    return Math.round(durationScore + efficiencyScore + deepScore + awakeningPenalty);
  }

  private calculateReadinessScore(activityScore: number, sleepScore: number, hrValues: number[]): number {
    const hrvComponent = hrValues.length > 0 ? 30 : 0; // Placeholder for HRV-based calculation
    return Math.round((activityScore * 0.3 + sleepScore * 0.4 + hrvComponent));
  }

  private calculateActiveMinutes(records: HealthRecord[]): number {
    const workouts = records.filter(r => r.type === 'workout');
    return Math.round(workouts.reduce((sum, w) => sum + ((w as any).duration || 0), 0) / 60);
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const aggregator = new TimeAggregator();
