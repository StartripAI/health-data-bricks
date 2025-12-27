/**
 * Health Data Bricks - Health Analytics Engine
 *
 * Advanced analytics for health data insights
 */

import { HealthRecord, HeartRate, SleepSession, Workout } from '../../core/types/health-record';
import { TimeAggregator, DailyHealthSummary } from '../aggregators/time-aggregator';

// ============================================================================
// Analytics Types
// ============================================================================

export interface HealthInsight {
  type: 'trend' | 'anomaly' | 'achievement' | 'recommendation';
  category: 'activity' | 'sleep' | 'heart' | 'general';
  title: string;
  description: string;
  severity?: 'info' | 'warning' | 'critical';
  confidence: number; // 0-1
  timestamp: string;
  relatedMetrics?: string[];
}

export interface TrendAnalysis {
  metric: string;
  period: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
  significance: 'low' | 'medium' | 'high';
  dataPoints: Array<{ date: string; value: number }>;
  forecast?: Array<{ date: string; value: number; confidence: number }>;
}

export interface CorrelationResult {
  metric1: string;
  metric2: string;
  correlation: number; // -1 to 1
  significance: 'low' | 'medium' | 'high';
  sampleSize: number;
  interpretation: string;
}

export interface HealthProfile {
  userId: string;
  generatedAt: string;
  summary: {
    overallScore: number;
    trend: 'improving' | 'stable' | 'declining';
    topStrengths: string[];
    areasForImprovement: string[];
  };
  metrics: {
    activity: {
      avgDailySteps: number;
      avgActiveMinutes: number;
      workoutsPerWeek: number;
      trend: TrendAnalysis;
    };
    sleep: {
      avgDuration: number;
      avgEfficiency: number;
      consistency: number;
      trend: TrendAnalysis;
    };
    heart: {
      avgRestingHR: number;
      avgHRV: number;
      trend: TrendAnalysis;
    };
  };
  insights: HealthInsight[];
  recommendations: string[];
}

// ============================================================================
// Health Analytics Class
// ============================================================================

export class HealthAnalytics {
  private aggregator: TimeAggregator;

  constructor() {
    this.aggregator = new TimeAggregator();
  }

  /**
   * Generate comprehensive health insights
   */
  generateInsights(records: HealthRecord[], days: number = 30): HealthInsight[] {
    const insights: HealthInsight[] = [];
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Filter records to the analysis period
    const periodRecords = records.filter(r => {
      const ts = this.getTimestamp(r);
      return ts && new Date(ts) >= startDate;
    });

    // Analyze different aspects
    insights.push(...this.analyzeActivityTrends(periodRecords));
    insights.push(...this.analyzeSleepPatterns(periodRecords));
    insights.push(...this.analyzeHeartHealth(periodRecords));
    insights.push(...this.detectAnomalies(periodRecords));
    insights.push(...this.generateAchievements(periodRecords));

    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze trends in a specific metric
   */
  analyzeTrend(
    records: HealthRecord[],
    metricExtractor: (r: HealthRecord) => number | null,
    metricName: string,
    days: number = 30
  ): TrendAnalysis {
    const aggregated = this.aggregator.aggregateByPeriod(records, 'day', metricExtractor);
    const dataPoints = aggregated.map(a => ({ date: a.period, value: a.avg || 0 }));

    // Calculate linear regression for trend
    const { slope, intercept, r2 } = this.linearRegression(dataPoints.map((d, i) => [i, d.value]));

    // Determine direction
    let direction: TrendAnalysis['direction'];
    if (Math.abs(slope) < 0.01) {
      direction = 'stable';
    } else {
      direction = slope > 0 ? 'increasing' : 'decreasing';
    }

    // Calculate percentage change
    const firstValue = dataPoints[0]?.value || 1;
    const lastValue = dataPoints[dataPoints.length - 1]?.value || firstValue;
    const changePercent = ((lastValue - firstValue) / firstValue) * 100;

    // Generate simple forecast
    const forecast = this.simpleForecast(dataPoints, 7, slope, intercept);

    return {
      metric: metricName,
      period: `${days} days`,
      direction,
      changePercent: Math.round(changePercent * 10) / 10,
      significance: r2 > 0.7 ? 'high' : r2 > 0.4 ? 'medium' : 'low',
      dataPoints,
      forecast,
    };
  }

  /**
   * Find correlations between health metrics
   */
  findCorrelations(records: HealthRecord[]): CorrelationResult[] {
    const correlations: CorrelationResult[] = [];

    // Extract daily summaries
    const dates = [...new Set(records.map(r => this.getTimestamp(r)?.slice(0, 10)).filter(Boolean))];
    const summaries = dates.map(date => this.aggregator.generateDailySummary(records, date!));

    // Sleep vs Activity
    const sleepActivity = this.calculateCorrelation(
      summaries.filter(s => s.sleep).map(s => s.sleep!.duration / 3600),
      summaries.map(s => s.activity.totalSteps)
    );
    if (sleepActivity.sampleSize > 7) {
      correlations.push({
        metric1: 'Sleep Duration',
        metric2: 'Daily Steps',
        ...sleepActivity,
        interpretation: this.interpretCorrelation(sleepActivity.correlation, 'sleep', 'activity'),
      });
    }

    // Resting HR vs Sleep Quality
    const hrSleep = this.calculateCorrelation(
      summaries.filter(s => s.vitals.restingHeartRate).map(s => s.vitals.restingHeartRate!),
      summaries.filter(s => s.sleep).map(s => s.sleep!.efficiency || 0)
    );
    if (hrSleep.sampleSize > 7) {
      correlations.push({
        metric1: 'Resting Heart Rate',
        metric2: 'Sleep Efficiency',
        ...hrSleep,
        interpretation: this.interpretCorrelation(hrSleep.correlation, 'heart rate', 'sleep quality'),
      });
    }

    return correlations;
  }

  /**
   * Generate a comprehensive health profile
   */
  generateHealthProfile(records: HealthRecord[], userId: string): HealthProfile {
    const insights = this.generateInsights(records, 30);
    const correlations = this.findCorrelations(records);

    // Calculate metrics
    const dates = [...new Set(records.map(r => this.getTimestamp(r)?.slice(0, 10)).filter(Boolean))];
    const summaries = dates.map(date => this.aggregator.generateDailySummary(records, date!));

    const avgSteps = this.average(summaries.map(s => s.activity.totalSteps));
    const avgActiveMinutes = this.average(summaries.map(s => s.activity.activeMinutes));
    const workoutsPerWeek = summaries.reduce((sum, s) => sum + s.activity.workouts, 0) / (dates.length / 7);

    const sleepSummaries = summaries.filter(s => s.sleep);
    const avgSleepDuration = this.average(sleepSummaries.map(s => s.sleep!.duration));
    const avgSleepEfficiency = this.average(sleepSummaries.map(s => s.sleep!.efficiency || 85));

    const heartSummaries = summaries.filter(s => s.vitals.restingHeartRate);
    const avgRestingHR = this.average(heartSummaries.map(s => s.vitals.restingHeartRate!));

    // Calculate overall score
    const activityScore = Math.min(avgSteps / 10000, 1) * 100;
    const sleepScore = Math.min(avgSleepDuration / (8 * 3600), 1) * avgSleepEfficiency;
    const overallScore = Math.round((activityScore + sleepScore) / 2);

    // Determine strengths and areas for improvement
    const strengths: string[] = [];
    const improvements: string[] = [];

    if (avgSteps >= 10000) strengths.push('Excellent daily step count');
    else improvements.push('Increase daily steps');

    if (avgSleepDuration >= 7 * 3600) strengths.push('Good sleep duration');
    else improvements.push('Aim for 7-8 hours of sleep');

    if (workoutsPerWeek >= 3) strengths.push('Regular exercise routine');
    else improvements.push('Add more workout sessions');

    return {
      userId,
      generatedAt: new Date().toISOString(),
      summary: {
        overallScore,
        trend: this.determineTrend(summaries),
        topStrengths: strengths.slice(0, 3),
        areasForImprovement: improvements.slice(0, 3),
      },
      metrics: {
        activity: {
          avgDailySteps: Math.round(avgSteps),
          avgActiveMinutes: Math.round(avgActiveMinutes),
          workoutsPerWeek: Math.round(workoutsPerWeek * 10) / 10,
          trend: this.analyzeTrend(records, r => r.type === 'steps' ? (r as any).value : null, 'steps'),
        },
        sleep: {
          avgDuration: Math.round(avgSleepDuration),
          avgEfficiency: Math.round(avgSleepEfficiency),
          consistency: this.calculateSleepConsistency(sleepSummaries),
          trend: this.analyzeTrend(
            records,
            r => r.type === 'sleep' ? (r as SleepSession).duration : null,
            'sleep_duration'
          ),
        },
        heart: {
          avgRestingHR: Math.round(avgRestingHR),
          avgHRV: 0, // Would need HRV data
          trend: this.analyzeTrend(
            records,
            r => r.type === 'heart_rate' && (r as HeartRate).context === 'resting' ? r.value : null,
            'resting_hr'
          ),
        },
      },
      insights,
      recommendations: this.generateRecommendations(insights, summaries),
    };
  }

  // ============================================================================
  // Private Analysis Methods
  // ============================================================================

  private analyzeActivityTrends(records: HealthRecord[]): HealthInsight[] {
    const insights: HealthInsight[] = [];
    const stepRecords = records.filter(r => r.type === 'steps');

    if (stepRecords.length > 7) {
      const trend = this.analyzeTrend(stepRecords, r => (r as any).value, 'steps', 7);

      if (trend.direction === 'increasing' && trend.changePercent > 10) {
        insights.push({
          type: 'trend',
          category: 'activity',
          title: 'Activity Increasing',
          description: `Your daily steps have increased by ${trend.changePercent}% over the past week.`,
          confidence: 0.8,
          timestamp: new Date().toISOString(),
          relatedMetrics: ['steps'],
        });
      }
    }

    return insights;
  }

  private analyzeSleepPatterns(records: HealthRecord[]): HealthInsight[] {
    const insights: HealthInsight[] = [];
    const sleepRecords = records.filter((r): r is SleepSession => r.type === 'sleep');

    if (sleepRecords.length > 3) {
      const avgDuration = this.average(sleepRecords.map(s => s.duration));

      if (avgDuration < 6 * 3600) {
        insights.push({
          type: 'recommendation',
          category: 'sleep',
          title: 'Insufficient Sleep',
          description: `Your average sleep duration is ${Math.round(avgDuration / 3600)} hours. Aim for 7-9 hours.`,
          severity: 'warning',
          confidence: 0.9,
          timestamp: new Date().toISOString(),
          relatedMetrics: ['sleep_duration'],
        });
      }
    }

    return insights;
  }

  private analyzeHeartHealth(records: HealthRecord[]): HealthInsight[] {
    const insights: HealthInsight[] = [];
    const hrRecords = records.filter((r): r is HeartRate => r.type === 'heart_rate');

    if (hrRecords.length > 10) {
      const restingHR = hrRecords.filter(r => r.context === 'resting').map(r => r.value);

      if (restingHR.length > 5) {
        const avgRestingHR = this.average(restingHR);

        if (avgRestingHR < 60) {
          insights.push({
            type: 'achievement',
            category: 'heart',
            title: 'Excellent Resting Heart Rate',
            description: `Your average resting heart rate of ${Math.round(avgRestingHR)} bpm indicates good cardiovascular fitness.`,
            confidence: 0.85,
            timestamp: new Date().toISOString(),
            relatedMetrics: ['resting_heart_rate'],
          });
        } else if (avgRestingHR > 80) {
          insights.push({
            type: 'recommendation',
            category: 'heart',
            title: 'Elevated Resting Heart Rate',
            description: `Your average resting heart rate is ${Math.round(avgRestingHR)} bpm. Consider more cardio exercise.`,
            severity: 'info',
            confidence: 0.75,
            timestamp: new Date().toISOString(),
            relatedMetrics: ['resting_heart_rate'],
          });
        }
      }
    }

    return insights;
  }

  private detectAnomalies(records: HealthRecord[]): HealthInsight[] {
    const insights: HealthInsight[] = [];

    // Detect unusual heart rate spikes
    const hrRecords = records.filter((r): r is HeartRate => r.type === 'heart_rate');
    const hrValues = hrRecords.map(r => r.value);
    const mean = this.average(hrValues);
    const stdDev = this.standardDeviation(hrValues);

    const anomalies = hrRecords.filter(r => Math.abs(r.value - mean) > 2 * stdDev);
    if (anomalies.length > 0 && anomalies.length < hrRecords.length * 0.05) {
      insights.push({
        type: 'anomaly',
        category: 'heart',
        title: 'Unusual Heart Rate Detected',
        description: `${anomalies.length} heart rate readings were significantly different from your normal range.`,
        severity: 'info',
        confidence: 0.7,
        timestamp: new Date().toISOString(),
        relatedMetrics: ['heart_rate'],
      });
    }

    return insights;
  }

  private generateAchievements(records: HealthRecord[]): HealthInsight[] {
    const insights: HealthInsight[] = [];

    // Check for step milestones
    const stepRecords = records.filter(r => r.type === 'steps');
    const maxSteps = Math.max(...stepRecords.map(r => (r as any).value));

    if (maxSteps >= 15000) {
      insights.push({
        type: 'achievement',
        category: 'activity',
        title: 'Step Champion',
        description: `You reached ${maxSteps.toLocaleString()} steps in a single day!`,
        confidence: 1,
        timestamp: new Date().toISOString(),
        relatedMetrics: ['steps'],
      });
    }

    return insights;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getTimestamp(record: HealthRecord): string | null {
    if ('timestamp' in record) return record.timestamp.datetime;
    if ('startTime' in record) return record.startTime.datetime;
    return null;
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = this.average(values);
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(this.average(squareDiffs));
  }

  private linearRegression(points: number[][]): { slope: number; intercept: number; r2: number } {
    const n = points.length;
    if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

    const sumX = points.reduce((sum, p) => sum + p[0], 0);
    const sumY = points.reduce((sum, p) => sum + p[1], 0);
    const sumXY = points.reduce((sum, p) => sum + p[0] * p[1], 0);
    const sumX2 = points.reduce((sum, p) => sum + p[0] * p[0], 0);
    const sumY2 = points.reduce((sum, p) => sum + p[1] * p[1], 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const ssRes = points.reduce((sum, p) => sum + Math.pow(p[1] - (slope * p[0] + intercept), 2), 0);
    const ssTot = points.reduce((sum, p) => sum + Math.pow(p[1] - sumY / n, 2), 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return { slope, intercept, r2 };
  }

  private simpleForecast(
    data: Array<{ date: string; value: number }>,
    days: number,
    slope: number,
    intercept: number
  ): Array<{ date: string; value: number; confidence: number }> {
    const forecast: Array<{ date: string; value: number; confidence: number }> = [];
    const lastDate = new Date(data[data.length - 1]?.date || new Date());

    for (let i = 1; i <= days; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);

      const x = data.length + i - 1;
      const predictedValue = slope * x + intercept;
      const confidence = Math.max(0.5, 1 - i * 0.05); // Decrease confidence over time

      forecast.push({
        date: forecastDate.toISOString().slice(0, 10),
        value: Math.round(predictedValue),
        confidence,
      });
    }

    return forecast;
  }

  private calculateCorrelation(x: number[], y: number[]): { correlation: number; significance: string; sampleSize: number } {
    const n = Math.min(x.length, y.length);
    if (n < 3) return { correlation: 0, significance: 'low', sampleSize: n };

    const meanX = this.average(x.slice(0, n));
    const meanY = this.average(y.slice(0, n));

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const correlation = denomX > 0 && denomY > 0 ? numerator / Math.sqrt(denomX * denomY) : 0;
    const significance = Math.abs(correlation) > 0.7 ? 'high' : Math.abs(correlation) > 0.4 ? 'medium' : 'low';

    return { correlation: Math.round(correlation * 100) / 100, significance, sampleSize: n };
  }

  private interpretCorrelation(correlation: number, metric1: string, metric2: string): string {
    if (correlation > 0.7) return `Strong positive relationship between ${metric1} and ${metric2}`;
    if (correlation > 0.4) return `Moderate positive relationship between ${metric1} and ${metric2}`;
    if (correlation > 0) return `Weak positive relationship between ${metric1} and ${metric2}`;
    if (correlation > -0.4) return `Weak negative relationship between ${metric1} and ${metric2}`;
    if (correlation > -0.7) return `Moderate negative relationship between ${metric1} and ${metric2}`;
    return `Strong negative relationship between ${metric1} and ${metric2}`;
  }

  private calculateSleepConsistency(summaries: DailyHealthSummary[]): number {
    const durations = summaries.filter(s => s.sleep).map(s => s.sleep!.duration);
    if (durations.length < 3) return 0;

    const stdDev = this.standardDeviation(durations);
    const mean = this.average(durations);

    // Lower coefficient of variation = more consistent
    const cv = mean > 0 ? stdDev / mean : 1;
    return Math.round(Math.max(0, (1 - cv) * 100));
  }

  private determineTrend(summaries: DailyHealthSummary[]): 'improving' | 'stable' | 'declining' {
    if (summaries.length < 7) return 'stable';

    const recentScores = summaries.slice(-7).map(s => s.scores.activityScore + s.scores.sleepScore);
    const olderScores = summaries.slice(-14, -7).map(s => s.scores.activityScore + s.scores.sleepScore);

    const recentAvg = this.average(recentScores);
    const olderAvg = this.average(olderScores);

    if (recentAvg > olderAvg * 1.05) return 'improving';
    if (recentAvg < olderAvg * 0.95) return 'declining';
    return 'stable';
  }

  private generateRecommendations(insights: HealthInsight[], summaries: DailyHealthSummary[]): string[] {
    const recommendations: string[] = [];

    // Based on insights
    const hasLowSleep = insights.some(i => i.category === 'sleep' && i.type === 'recommendation');
    if (hasLowSleep) {
      recommendations.push('Establish a consistent bedtime routine to improve sleep duration');
    }

    const hasHighHR = insights.some(i => i.category === 'heart' && i.title.includes('Elevated'));
    if (hasHighHR) {
      recommendations.push('Include more cardio exercises like walking, cycling, or swimming');
    }

    // Based on data
    const avgSteps = this.average(summaries.map(s => s.activity.totalSteps));
    if (avgSteps < 7000) {
      recommendations.push('Take short walking breaks throughout the day to increase step count');
    }

    const workouts = summaries.reduce((sum, s) => sum + s.activity.workouts, 0);
    if (workouts < summaries.length / 7 * 2) {
      recommendations.push('Aim for at least 2-3 workout sessions per week');
    }

    return recommendations.slice(0, 5);
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const healthAnalytics = new HealthAnalytics();
