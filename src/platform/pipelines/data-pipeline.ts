/**
 * Health Data Bricks - Data Pipeline
 *
 * Layer 2: Platform Layer - Data processing pipelines
 * Handles data ingestion, transformation, and routing
 */

import { HealthRecord, HealthDataBrick } from '../../core/types/health-record';
import { DataNormalizer, NormalizationConfig, detectOutliers, deduplicateRecords } from '../../core/normalizers/data-normalizer';

// ============================================================================
// Pipeline Configuration
// ============================================================================

export interface PipelineConfig {
  name: string;
  normalization?: Partial<NormalizationConfig>;
  enableOutlierDetection?: boolean;
  enableDeduplication?: boolean;
  deduplicationWindowMs?: number;
  transformers?: DataTransformer[];
  filters?: DataFilter[];
  validators?: DataValidator[];
}

export type DataTransformer = (records: HealthRecord[]) => HealthRecord[];
export type DataFilter = (record: HealthRecord) => boolean;
export type DataValidator = (record: HealthRecord) => { valid: boolean; error?: string };

// ============================================================================
// Pipeline Stage Results
// ============================================================================

export interface PipelineStageResult {
  stage: string;
  inputCount: number;
  outputCount: number;
  droppedCount: number;
  errors: string[];
  durationMs: number;
}

export interface PipelineResult {
  success: boolean;
  brick: HealthDataBrick;
  stages: PipelineStageResult[];
  totalDurationMs: number;
  inputCount: number;
  outputCount: number;
  outliers?: HealthRecord[];
}

// ============================================================================
// Data Pipeline Class
// ============================================================================

export class DataPipeline {
  private config: PipelineConfig;
  private normalizer: DataNormalizer;

  constructor(config: PipelineConfig) {
    this.config = {
      enableOutlierDetection: true,
      enableDeduplication: true,
      deduplicationWindowMs: 60000,
      ...config,
    };
    this.normalizer = new DataNormalizer(config.normalization);
  }

  /**
   * Process records through the pipeline
   */
  async process(
    records: HealthRecord[],
    userId: string,
    sourceId: string
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const stages: PipelineStageResult[] = [];
    let currentRecords = [...records];
    let outliers: HealthRecord[] = [];

    // Stage 1: Validation
    const validationResult = this.runValidation(currentRecords);
    stages.push(validationResult.stage);
    currentRecords = validationResult.records;

    // Stage 2: Filtering
    const filterResult = this.runFilters(currentRecords);
    stages.push(filterResult.stage);
    currentRecords = filterResult.records;

    // Stage 3: Normalization
    const normalizationResult = this.runNormalization(currentRecords);
    stages.push(normalizationResult.stage);
    currentRecords = normalizationResult.records;

    // Stage 4: Outlier Detection
    if (this.config.enableOutlierDetection) {
      const outlierResult = this.runOutlierDetection(currentRecords);
      stages.push(outlierResult.stage);
      currentRecords = outlierResult.records;
      outliers = outlierResult.outliers;
    }

    // Stage 5: Deduplication
    if (this.config.enableDeduplication) {
      const dedupeResult = this.runDeduplication(currentRecords);
      stages.push(dedupeResult.stage);
      currentRecords = dedupeResult.records;
    }

    // Stage 6: Custom Transformations
    const transformResult = this.runTransformers(currentRecords);
    stages.push(transformResult.stage);
    currentRecords = transformResult.records;

    // Create the data brick
    const brick: HealthDataBrick = {
      id: this.generateBrickId(),
      userId,
      records: currentRecords,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: sourceId,
        version: '1.0.0',
      },
    };

    return {
      success: true,
      brick,
      stages,
      totalDurationMs: Date.now() - startTime,
      inputCount: records.length,
      outputCount: currentRecords.length,
      outliers: outliers.length > 0 ? outliers : undefined,
    };
  }

  // ============================================================================
  // Pipeline Stages
  // ============================================================================

  private runValidation(records: HealthRecord[]): { stage: PipelineStageResult; records: HealthRecord[] } {
    const startTime = Date.now();
    const errors: string[] = [];
    const validRecords: HealthRecord[] = [];

    for (const record of records) {
      if (this.config.validators) {
        let isValid = true;
        for (const validator of this.config.validators) {
          const result = validator(record);
          if (!result.valid) {
            isValid = false;
            if (result.error) errors.push(result.error);
            break;
          }
        }
        if (isValid) validRecords.push(record);
      } else {
        validRecords.push(record);
      }
    }

    return {
      stage: {
        stage: 'validation',
        inputCount: records.length,
        outputCount: validRecords.length,
        droppedCount: records.length - validRecords.length,
        errors,
        durationMs: Date.now() - startTime,
      },
      records: validRecords,
    };
  }

  private runFilters(records: HealthRecord[]): { stage: PipelineStageResult; records: HealthRecord[] } {
    const startTime = Date.now();
    let filtered = records;

    if (this.config.filters) {
      for (const filter of this.config.filters) {
        filtered = filtered.filter(filter);
      }
    }

    return {
      stage: {
        stage: 'filtering',
        inputCount: records.length,
        outputCount: filtered.length,
        droppedCount: records.length - filtered.length,
        errors: [],
        durationMs: Date.now() - startTime,
      },
      records: filtered,
    };
  }

  private runNormalization(records: HealthRecord[]): { stage: PipelineStageResult; records: HealthRecord[] } {
    const startTime = Date.now();
    const errors: string[] = [];
    const normalized: HealthRecord[] = [];

    for (const record of records) {
      try {
        normalized.push(this.normalizer.normalize(record));
      } catch (e) {
        errors.push(`Normalization error: ${e}`);
      }
    }

    return {
      stage: {
        stage: 'normalization',
        inputCount: records.length,
        outputCount: normalized.length,
        droppedCount: records.length - normalized.length,
        errors,
        durationMs: Date.now() - startTime,
      },
      records: normalized,
    };
  }

  private runOutlierDetection(records: HealthRecord[]): {
    stage: PipelineStageResult;
    records: HealthRecord[];
    outliers: HealthRecord[];
  } {
    const startTime = Date.now();
    const { valid, outliers } = detectOutliers(records);

    return {
      stage: {
        stage: 'outlier_detection',
        inputCount: records.length,
        outputCount: valid.length,
        droppedCount: outliers.length,
        errors: [],
        durationMs: Date.now() - startTime,
      },
      records: valid,
      outliers,
    };
  }

  private runDeduplication(records: HealthRecord[]): { stage: PipelineStageResult; records: HealthRecord[] } {
    const startTime = Date.now();
    const deduplicated = deduplicateRecords(records, this.config.deduplicationWindowMs);

    return {
      stage: {
        stage: 'deduplication',
        inputCount: records.length,
        outputCount: deduplicated.length,
        droppedCount: records.length - deduplicated.length,
        errors: [],
        durationMs: Date.now() - startTime,
      },
      records: deduplicated,
    };
  }

  private runTransformers(records: HealthRecord[]): { stage: PipelineStageResult; records: HealthRecord[] } {
    const startTime = Date.now();
    let transformed = records;

    if (this.config.transformers) {
      for (const transformer of this.config.transformers) {
        transformed = transformer(transformed);
      }
    }

    return {
      stage: {
        stage: 'transformation',
        inputCount: records.length,
        outputCount: transformed.length,
        droppedCount: records.length - transformed.length,
        errors: [],
        durationMs: Date.now() - startTime,
      },
      records: transformed,
    };
  }

  private generateBrickId(): string {
    return `brick_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Pre-built Pipeline Factories
// ============================================================================

export function createAppleHealthPipeline(): DataPipeline {
  return new DataPipeline({
    name: 'apple_health_pipeline',
    normalization: {
      temperature: { unit: 'celsius' },
      weight: { unit: 'kg' },
      distance: { unit: 'meters' },
    },
    enableOutlierDetection: true,
    enableDeduplication: true,
  });
}

export function createFitbitPipeline(): DataPipeline {
  return new DataPipeline({
    name: 'fitbit_pipeline',
    normalization: {
      temperature: { unit: 'celsius' },
      weight: { unit: 'kg' },
      distance: { unit: 'meters' },
    },
    enableOutlierDetection: true,
    enableDeduplication: true,
    deduplicationWindowMs: 30000, // Fitbit has finer granularity
  });
}

export function createGarminPipeline(): DataPipeline {
  return new DataPipeline({
    name: 'garmin_pipeline',
    normalization: {
      temperature: { unit: 'celsius' },
      weight: { unit: 'kg' },
      distance: { unit: 'meters' },
    },
    enableOutlierDetection: true,
    enableDeduplication: true,
  });
}

export function createEHRPipeline(): DataPipeline {
  return new DataPipeline({
    name: 'ehr_pipeline',
    normalization: {
      temperature: { unit: 'celsius' },
      weight: { unit: 'kg' },
    },
    // EHR data is already validated, less aggressive processing
    enableOutlierDetection: false,
    enableDeduplication: false,
  });
}
