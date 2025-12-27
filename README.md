# Health Data Bricks 🧱

**AI-Native Health Data Infrastructure**

A modular, open-source health data platform designed for the AI era. Health Data Bricks provides a unified framework for ingesting, normalizing, analyzing, and querying health data from multiple sources with built-in AI integration via the Model Context Protocol (MCP).

[![npm version](https://badge.fury.io/js/health-data-bricks.svg)](https://badge.fury.io/js/health-data-bricks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     MCP Server (AI Integration)                   │   │
│  │   • Health data queries      • Trend analysis                    │   │
│  │   • Insight generation       • FHIR export                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│                        PLATFORM LAYER                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │   Data Pipeline   │  │   Aggregators    │  │     Analytics        │  │
│  │  • Validation     │  │  • Time-based    │  │  • Trend detection   │  │
│  │  • Normalization  │  │  • Daily summary │  │  • Correlations      │  │
│  │  • Deduplication  │  │  • Weekly trends │  │  • Health profile    │  │
│  │  • Outlier detect │  │                  │  │  • Insights          │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                          CORE LAYER                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │   Health Types    │  │       FHIR       │  │    Normalizers       │  │
│  │  • Vitals         │  │  • R4 Types      │  │  • Unit conversion   │  │
│  │  • Activity       │  │  • Observations  │  │  • Data validation   │  │
│  │  • Sleep          │  │  • LOINC codes   │  │  • Outlier detection │  │
│  │  • Lab results    │  │  • Converter     │  │                      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                         DATA SOURCES                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────────┐   │
│  │Apple Health│  │   Fitbit   │  │   Garmin   │  │   EHR Systems   │   │
│  └────────────┘  └────────────┘  └────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Features

### 🔌 Multi-Source Data Ingestion
- **Apple Health** - Parse XML exports with full support for workouts, vitals, and sleep data
- **Fitbit** - API response parsing for heart rate, activity, sleep, and weight
- **Garmin** - Connect API data and FIT file support
- **Google Fit** - REST API integration
- **EHR/FHIR** - Bidirectional FHIR R4 conversion

### 🔄 Data Processing Pipeline
- Automatic unit normalization (metric/imperial)
- Outlier detection and filtering
- Deduplication with configurable time windows
- Validation against health-specific schemas

### 📊 Analytics Engine
- Daily/weekly/monthly health summaries
- Trend analysis with statistical significance
- Correlation discovery between metrics
- AI-generated health insights
- Health profile with scores and recommendations

### 🤖 AI-Native Integration (MCP)
Built-in Model Context Protocol server enabling LLMs to:
- Query health data with natural language
- Generate personalized insights
- Analyze trends and patterns
- Export to FHIR for interoperability

### ⚡ Physics-Inspired Processing (NEW)
Based on the Unified Syntropy Math-Physics Kernel (USMK) framework:
- **Surprise Filter** (Free Energy Principle) - Only store data that deviates from predictions, reducing storage by 90%+
- **Continuous Dynamics** (CfC Networks) - Handle non-uniform time sampling from wearables correctly
- **Intervention Planner** (Least Action) - Find minimal actions for maximum health impact

## Installation

```bash
npm install health-data-bricks
```

## Quick Start

### Parse Apple Health Export

```typescript
import { parseAppleHealthExport, DataPipeline } from 'health-data-bricks';

// Parse Apple Health XML export
const xmlContent = fs.readFileSync('export.xml', 'utf-8');
const { records, workouts, metadata } = parseAppleHealthExport(xmlContent);

console.log(`Parsed ${metadata.recordCount} records and ${metadata.workoutCount} workouts`);

// Process through pipeline
const pipeline = new DataPipeline({
  name: 'apple_health',
  normalization: {
    temperature: { unit: 'celsius' },
    weight: { unit: 'kg' },
  },
  enableOutlierDetection: true,
  enableDeduplication: true,
});

const result = await pipeline.process(records, 'user_123', 'apple_health');
console.log(`Processed ${result.outputCount} valid records`);
```

### Generate Health Insights

```typescript
import { HealthAnalytics, TimeAggregator } from 'health-data-bricks';

const analytics = new HealthAnalytics();
const aggregator = new TimeAggregator();

// Get daily summary
const summary = aggregator.generateDailySummary(records, '2024-01-15');
console.log(`Steps: ${summary.activity.totalSteps}`);
console.log(`Sleep: ${summary.sleep?.duration / 3600} hours`);

// Generate insights
const insights = analytics.generateInsights(records, 30);
for (const insight of insights) {
  console.log(`[${insight.type}] ${insight.title}: ${insight.description}`);
}

// Full health profile
const profile = analytics.generateHealthProfile(records, 'user_123');
console.log(`Health Score: ${profile.summary.overallScore}/100`);
console.log(`Trend: ${profile.summary.trend}`);
```

### MCP Server Integration

```typescript
import { HealthDataMCPServer } from 'health-data-bricks';

const mcpServer = new HealthDataMCPServer();

// Register data bricks
mcpServer.registerDataBrick({
  id: 'brick_001',
  userId: 'user_123',
  records: processedRecords,
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: 'apple_health',
    version: '1.0.0',
  },
});

// Get available tools for LLM
const tools = mcpServer.getTools();
// Returns tool definitions for: get_health_summary, analyze_health_trends,
// get_health_insights, get_health_profile, query_health_records, etc.

// Execute a tool (called by LLM)
const result = await mcpServer.executeTool('get_health_summary', {
  userId: 'user_123',
  date: '2024-01-15',
});
```

### FHIR Export

```typescript
import { healthRecordsToFHIRBundle } from 'health-data-bricks';

// Convert to FHIR R4 Bundle
const fhirBundle = healthRecordsToFHIRBundle(records, 'patient_123');

console.log(`FHIR Bundle with ${fhirBundle.total} observations`);
// Can be sent to any FHIR-compliant EHR system
```

### Physics Engine (Surprise Filtering)

```typescript
import {
  SurpriseFilter,
  HealthStateEstimator,
  InterventionPlanner
} from 'health-data-bricks';

// Only keep surprising data (90%+ reduction)
const filter = new SurpriseFilter({ thresholdK: 2.0 });
const result = filter.filterBatch(records);
console.log(`Kept ${result.stats.kept} of ${result.stats.total} records`);
console.log(`Filter rate: ${(result.stats.filterRate * 100).toFixed(1)}%`);

// Continuous state estimation (handles time gaps)
const estimator = new HealthStateEstimator();
for (const record of records) {
  const state = estimator.update(
    { cardiovascular: record.value, stress: 0.5 },
    Date.now() / 1000
  );
  console.log('Health state:', state.dimensions);
}

// Plan minimal interventions
const planner = new InterventionPlanner();
const plan = planner.plan(
  { energy: 0.3, stress: 0.8, cardiovascular: 0.5 },  // Current
  { energy: 0.7, stress: 0.3, cardiovascular: 0.6 }   // Target
);

console.log(`Recommended ${plan.activeCount} actions:`);
for (const action of plan.actions) {
  console.log(`  ${action.priority}. ${action.action.name} (impact: ${action.weight.toFixed(2)})`);
}
```

## Supported Health Data Types

| Category | Types |
|----------|-------|
| **Vitals** | Heart Rate, Blood Pressure, Blood Oxygen (SpO2), Body Temperature, Respiratory Rate, HRV |
| **Activity** | Steps, Distance, Calories, Workouts |
| **Sleep** | Sleep Sessions, Sleep Stages (Light, Deep, REM, Awake) |
| **Body** | Weight, Height, Body Composition (Fat %, Muscle Mass) |
| **Labs** | Lab Results with LOINC codes |
| **Nutrition** | Meals, Macronutrients, Water Intake |

## MCP Tools

The MCP server provides these tools for AI integration:

| Tool | Description |
|------|-------------|
| `get_health_summary` | Daily health summary with vitals, activity, and sleep |
| `analyze_health_trends` | Trend analysis for specific metrics over time |
| `get_health_insights` | AI-generated insights about health patterns |
| `get_health_profile` | Comprehensive health profile with scores |
| `query_health_records` | Query raw health records with filters |
| `compare_periods` | Compare health metrics between time periods |
| `export_to_fhir` | Export to FHIR R4 format |

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Google Fit parser
- [ ] Samsung Health parser
- [ ] Whoop integration
- [ ] Oura Ring integration
- [ ] Real-time streaming support
- [ ] GraphQL API layer
- [ ] More MCP tools for AI agents
- [ ] Health data visualization components

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [FHIR](https://hl7.org/fhir/) - Fast Healthcare Interoperability Resources
- [LOINC](https://loinc.org/) - Logical Observation Identifiers Names and Codes
- [MCP](https://modelcontextprotocol.io/) - Model Context Protocol
