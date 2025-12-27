/**
 * Health Data Bricks - MCP Server
 *
 * Model Context Protocol server for AI integration
 * Enables LLMs like Claude to query and analyze health data
 */

import { HealthRecord, HealthDataBrick } from '../core/types/health-record';
import { TimeAggregator, DailyHealthSummary } from '../platform/aggregators/time-aggregator';
import { HealthAnalytics, HealthInsight, HealthProfile } from '../platform/analytics/health-analytics';
import { healthRecordsToFHIRBundle } from '../core/fhir/converter';

// ============================================================================
// MCP Types
// ============================================================================

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

// ============================================================================
// Health Data MCP Server
// ============================================================================

export class HealthDataMCPServer {
  private dataBricks: Map<string, HealthDataBrick> = new Map();
  private aggregator: TimeAggregator;
  private analytics: HealthAnalytics;

  constructor() {
    this.aggregator = new TimeAggregator();
    this.analytics = new HealthAnalytics();
  }

  /**
   * Register a data brick for querying
   */
  registerDataBrick(brick: HealthDataBrick): void {
    this.dataBricks.set(brick.id, brick);
  }

  /**
   * Get available MCP tools
   */
  getTools(): MCPTool[] {
    return [
      {
        name: 'get_health_summary',
        description: 'Get a daily health summary including vitals, activity, and sleep data for a specific date',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID to get health data for',
            },
            date: {
              type: 'string',
              description: 'The date to get summary for (YYYY-MM-DD format)',
            },
          },
          required: ['userId', 'date'],
        },
      },
      {
        name: 'analyze_health_trends',
        description: 'Analyze health trends over a specified period, identifying patterns and changes',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID to analyze',
            },
            metric: {
              type: 'string',
              description: 'The health metric to analyze',
              enum: ['steps', 'heart_rate', 'sleep_duration', 'calories', 'weight'],
            },
            days: {
              type: 'string',
              description: 'Number of days to analyze (7, 14, 30, 90)',
            },
          },
          required: ['userId', 'metric'],
        },
      },
      {
        name: 'get_health_insights',
        description: 'Get AI-generated insights about the user\'s health patterns, anomalies, and achievements',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID to get insights for',
            },
            category: {
              type: 'string',
              description: 'Filter insights by category',
              enum: ['activity', 'sleep', 'heart', 'general', 'all'],
            },
          },
          required: ['userId'],
        },
      },
      {
        name: 'get_health_profile',
        description: 'Get a comprehensive health profile with scores, trends, and recommendations',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID to get profile for',
            },
          },
          required: ['userId'],
        },
      },
      {
        name: 'query_health_records',
        description: 'Query raw health records with filters for date range and record type',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID to query',
            },
            recordType: {
              type: 'string',
              description: 'Type of health record to query',
              enum: ['heart_rate', 'steps', 'sleep', 'workout', 'weight', 'blood_pressure', 'blood_oxygen'],
            },
            startDate: {
              type: 'string',
              description: 'Start date for query (YYYY-MM-DD)',
            },
            endDate: {
              type: 'string',
              description: 'End date for query (YYYY-MM-DD)',
            },
            limit: {
              type: 'string',
              description: 'Maximum number of records to return',
            },
          },
          required: ['userId', 'recordType'],
        },
      },
      {
        name: 'compare_periods',
        description: 'Compare health metrics between two time periods',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID to compare',
            },
            metric: {
              type: 'string',
              description: 'The metric to compare',
              enum: ['steps', 'sleep', 'heart_rate', 'calories', 'workouts'],
            },
            period1Start: {
              type: 'string',
              description: 'Start date of first period (YYYY-MM-DD)',
            },
            period1End: {
              type: 'string',
              description: 'End date of first period (YYYY-MM-DD)',
            },
            period2Start: {
              type: 'string',
              description: 'Start date of second period (YYYY-MM-DD)',
            },
            period2End: {
              type: 'string',
              description: 'End date of second period (YYYY-MM-DD)',
            },
          },
          required: ['userId', 'metric', 'period1Start', 'period1End', 'period2Start', 'period2End'],
        },
      },
      {
        name: 'export_to_fhir',
        description: 'Export health records to FHIR R4 format for interoperability',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The user ID to export',
            },
            startDate: {
              type: 'string',
              description: 'Start date for export (YYYY-MM-DD)',
            },
            endDate: {
              type: 'string',
              description: 'End date for export (YYYY-MM-DD)',
            },
          },
          required: ['userId'],
        },
      },
    ];
  }

  /**
   * Execute an MCP tool
   */
  async executeTool(name: string, args: Record<string, string>): Promise<MCPToolResult> {
    try {
      switch (name) {
        case 'get_health_summary':
          return this.handleGetHealthSummary(args);
        case 'analyze_health_trends':
          return this.handleAnalyzeHealthTrends(args);
        case 'get_health_insights':
          return this.handleGetHealthInsights(args);
        case 'get_health_profile':
          return this.handleGetHealthProfile(args);
        case 'query_health_records':
          return this.handleQueryHealthRecords(args);
        case 'compare_periods':
          return this.handleComparePeriods(args);
        case 'export_to_fhir':
          return this.handleExportToFHIR(args);
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error executing tool: ${error}` }],
        isError: true,
      };
    }
  }

  /**
   * Get available resources
   */
  getResources(): MCPResource[] {
    const resources: MCPResource[] = [];

    for (const [id, brick] of this.dataBricks) {
      resources.push({
        uri: `health://bricks/${id}`,
        name: `Health Data Brick: ${id}`,
        description: `Health records for user ${brick.userId} (${brick.records.length} records)`,
        mimeType: 'application/json',
      });
    }

    return resources;
  }

  // ============================================================================
  // Tool Handlers
  // ============================================================================

  private handleGetHealthSummary(args: Record<string, string>): MCPToolResult {
    const { userId, date } = args;
    const records = this.getRecordsForUser(userId);

    if (records.length === 0) {
      return {
        content: [{ type: 'text', text: `No health data found for user ${userId}` }],
      };
    }

    const summary = this.aggregator.generateDailySummary(records, date);
    return {
      content: [{
        type: 'text',
        text: this.formatDailySummary(summary),
      }],
    };
  }

  private handleAnalyzeHealthTrends(args: Record<string, string>): MCPToolResult {
    const { userId, metric, days = '30' } = args;
    const records = this.getRecordsForUser(userId);

    if (records.length === 0) {
      return {
        content: [{ type: 'text', text: `No health data found for user ${userId}` }],
      };
    }

    const metricExtractor = this.getMetricExtractor(metric);
    const trend = this.analytics.analyzeTrend(records, metricExtractor, metric, parseInt(days));

    return {
      content: [{
        type: 'text',
        text: this.formatTrendAnalysis(trend, metric),
      }],
    };
  }

  private handleGetHealthInsights(args: Record<string, string>): MCPToolResult {
    const { userId, category = 'all' } = args;
    const records = this.getRecordsForUser(userId);

    if (records.length === 0) {
      return {
        content: [{ type: 'text', text: `No health data found for user ${userId}` }],
      };
    }

    let insights = this.analytics.generateInsights(records);

    if (category !== 'all') {
      insights = insights.filter(i => i.category === category);
    }

    return {
      content: [{
        type: 'text',
        text: this.formatInsights(insights),
      }],
    };
  }

  private handleGetHealthProfile(args: Record<string, string>): MCPToolResult {
    const { userId } = args;
    const records = this.getRecordsForUser(userId);

    if (records.length === 0) {
      return {
        content: [{ type: 'text', text: `No health data found for user ${userId}` }],
      };
    }

    const profile = this.analytics.generateHealthProfile(records, userId);
    return {
      content: [{
        type: 'text',
        text: this.formatHealthProfile(profile),
      }],
    };
  }

  private handleQueryHealthRecords(args: Record<string, string>): MCPToolResult {
    const { userId, recordType, startDate, endDate, limit = '100' } = args;
    let records = this.getRecordsForUser(userId);

    // Filter by type
    records = records.filter(r => r.type === recordType);

    // Filter by date range
    if (startDate || endDate) {
      records = records.filter(r => {
        const ts = 'timestamp' in r ? r.timestamp.datetime : (r as any).startTime?.datetime;
        if (!ts) return false;
        const date = ts.slice(0, 10);
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
      });
    }

    // Limit results
    records = records.slice(0, parseInt(limit));

    return {
      content: [{
        type: 'text',
        text: `Found ${records.length} ${recordType} records:\n\n${JSON.stringify(records, null, 2)}`,
      }],
    };
  }

  private handleComparePeriods(args: Record<string, string>): MCPToolResult {
    const { userId, metric, period1Start, period1End, period2Start, period2End } = args;
    const records = this.getRecordsForUser(userId);

    const period1Records = this.filterRecordsByDateRange(records, period1Start, period1End);
    const period2Records = this.filterRecordsByDateRange(records, period2Start, period2End);

    const metricExtractor = this.getMetricExtractor(metric);
    const period1Values = period1Records.map(metricExtractor).filter((v): v is number => v !== null);
    const period2Values = period2Records.map(metricExtractor).filter((v): v is number => v !== null);

    const avg1 = period1Values.length > 0 ? period1Values.reduce((a, b) => a + b, 0) / period1Values.length : 0;
    const avg2 = period2Values.length > 0 ? period2Values.reduce((a, b) => a + b, 0) / period2Values.length : 0;
    const change = avg1 > 0 ? ((avg2 - avg1) / avg1) * 100 : 0;

    return {
      content: [{
        type: 'text',
        text: `## ${metric.replace('_', ' ').toUpperCase()} Comparison

**Period 1** (${period1Start} to ${period1End}):
- Records: ${period1Values.length}
- Average: ${Math.round(avg1 * 10) / 10}

**Period 2** (${period2Start} to ${period2End}):
- Records: ${period2Values.length}
- Average: ${Math.round(avg2 * 10) / 10}

**Change**: ${change >= 0 ? '+' : ''}${Math.round(change * 10) / 10}%`,
      }],
    };
  }

  private handleExportToFHIR(args: Record<string, string>): MCPToolResult {
    const { userId, startDate, endDate } = args;
    let records = this.getRecordsForUser(userId);

    if (startDate || endDate) {
      records = this.filterRecordsByDateRange(records, startDate, endDate);
    }

    const bundle = healthRecordsToFHIRBundle(records, userId);

    return {
      content: [{
        type: 'text',
        text: `FHIR R4 Bundle with ${bundle.total} observations:\n\n${JSON.stringify(bundle, null, 2)}`,
      }],
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getRecordsForUser(userId: string): HealthRecord[] {
    const records: HealthRecord[] = [];

    for (const brick of this.dataBricks.values()) {
      if (brick.userId === userId) {
        records.push(...brick.records);
      }
    }

    return records;
  }

  private filterRecordsByDateRange(records: HealthRecord[], startDate?: string, endDate?: string): HealthRecord[] {
    return records.filter(r => {
      const ts = 'timestamp' in r ? r.timestamp.datetime : (r as any).startTime?.datetime;
      if (!ts) return false;
      const date = ts.slice(0, 10);
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    });
  }

  private getMetricExtractor(metric: string): (r: HealthRecord) => number | null {
    const extractors: Record<string, (r: HealthRecord) => number | null> = {
      steps: r => r.type === 'steps' ? (r as any).value : null,
      heart_rate: r => r.type === 'heart_rate' ? (r as any).value : null,
      sleep_duration: r => r.type === 'sleep' ? (r as any).duration : null,
      calories: r => r.type === 'calories' ? (r as any).value : null,
      weight: r => r.type === 'weight' ? (r as any).value : null,
    };
    return extractors[metric] || (() => null);
  }

  private formatDailySummary(summary: DailyHealthSummary): string {
    let text = `## Health Summary for ${summary.date}\n\n`;

    text += `### Vitals\n`;
    if (summary.vitals.avgHeartRate) text += `- Average Heart Rate: ${Math.round(summary.vitals.avgHeartRate)} bpm\n`;
    if (summary.vitals.restingHeartRate) text += `- Resting Heart Rate: ${Math.round(summary.vitals.restingHeartRate)} bpm\n`;

    text += `\n### Activity\n`;
    text += `- Steps: ${summary.activity.totalSteps.toLocaleString()}\n`;
    text += `- Distance: ${(summary.activity.totalDistance / 1000).toFixed(1)} km\n`;
    text += `- Calories: ${Math.round(summary.activity.totalCalories)} kcal\n`;
    text += `- Active Minutes: ${summary.activity.activeMinutes}\n`;
    text += `- Workouts: ${summary.activity.workouts}\n`;

    if (summary.sleep) {
      text += `\n### Sleep\n`;
      text += `- Duration: ${(summary.sleep.duration / 3600).toFixed(1)} hours\n`;
      if (summary.sleep.efficiency) text += `- Efficiency: ${summary.sleep.efficiency}%\n`;
      text += `- Deep Sleep: ${summary.sleep.deepSleepMinutes} minutes\n`;
      text += `- REM Sleep: ${summary.sleep.remSleepMinutes} minutes\n`;
    }

    text += `\n### Scores\n`;
    text += `- Activity Score: ${summary.scores.activityScore}/100\n`;
    text += `- Sleep Score: ${summary.scores.sleepScore}/100\n`;
    text += `- Readiness Score: ${summary.scores.readinessScore}/100\n`;

    return text;
  }

  private formatTrendAnalysis(trend: any, metric: string): string {
    let text = `## ${metric.replace('_', ' ').toUpperCase()} Trend Analysis\n\n`;
    text += `- **Period**: ${trend.period}\n`;
    text += `- **Direction**: ${trend.direction}\n`;
    text += `- **Change**: ${trend.changePercent >= 0 ? '+' : ''}${trend.changePercent}%\n`;
    text += `- **Statistical Significance**: ${trend.significance}\n`;
    text += `- **Data Points**: ${trend.dataPoints.length}\n`;

    if (trend.forecast && trend.forecast.length > 0) {
      text += `\n### 7-Day Forecast\n`;
      for (const point of trend.forecast) {
        text += `- ${point.date}: ${point.value} (confidence: ${Math.round(point.confidence * 100)}%)\n`;
      }
    }

    return text;
  }

  private formatInsights(insights: HealthInsight[]): string {
    if (insights.length === 0) {
      return 'No insights available for this period.';
    }

    let text = `## Health Insights\n\n`;

    for (const insight of insights.slice(0, 10)) {
      const icon = insight.type === 'achievement' ? '🏆' :
                   insight.type === 'anomaly' ? '⚠️' :
                   insight.type === 'trend' ? '📈' : '💡';

      text += `### ${icon} ${insight.title}\n`;
      text += `${insight.description}\n`;
      text += `- Category: ${insight.category}\n`;
      text += `- Confidence: ${Math.round(insight.confidence * 100)}%\n`;
      if (insight.severity) text += `- Severity: ${insight.severity}\n`;
      text += '\n';
    }

    return text;
  }

  private formatHealthProfile(profile: HealthProfile): string {
    let text = `## Health Profile\n`;
    text += `Generated: ${profile.generatedAt}\n\n`;

    text += `### Overall Summary\n`;
    text += `- **Health Score**: ${profile.summary.overallScore}/100\n`;
    text += `- **Trend**: ${profile.summary.trend}\n`;
    text += `- **Strengths**: ${profile.summary.topStrengths.join(', ') || 'None identified'}\n`;
    text += `- **Areas to Improve**: ${profile.summary.areasForImprovement.join(', ') || 'None identified'}\n\n`;

    text += `### Activity\n`;
    text += `- Average Daily Steps: ${profile.metrics.activity.avgDailySteps.toLocaleString()}\n`;
    text += `- Average Active Minutes: ${profile.metrics.activity.avgActiveMinutes}\n`;
    text += `- Workouts per Week: ${profile.metrics.activity.workoutsPerWeek}\n\n`;

    text += `### Sleep\n`;
    text += `- Average Duration: ${(profile.metrics.sleep.avgDuration / 3600).toFixed(1)} hours\n`;
    text += `- Average Efficiency: ${profile.metrics.sleep.avgEfficiency}%\n`;
    text += `- Consistency: ${profile.metrics.sleep.consistency}%\n\n`;

    text += `### Heart Health\n`;
    text += `- Average Resting HR: ${profile.metrics.heart.avgRestingHR} bpm\n\n`;

    text += `### Recommendations\n`;
    for (const rec of profile.recommendations) {
      text += `- ${rec}\n`;
    }

    return text;
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const mcpServer = new HealthDataMCPServer();
