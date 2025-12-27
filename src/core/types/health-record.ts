/**
 * Health Data Bricks - Core Health Record Types
 *
 * Layer 1: Core Data Primitives
 * These types form the foundation of all health data processing
 */

import { z } from 'zod';

// ============================================================================
// Base Types
// ============================================================================

export const TimestampSchema = z.object({
  datetime: z.string().datetime(),
  timezone: z.string().optional(),
  source: z.enum(['device', 'user', 'system', 'inferred']).default('system'),
});

export type Timestamp = z.infer<typeof TimestampSchema>;

export const DataSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['wearable', 'ehr', 'manual', 'lab', 'imaging', 'app']),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  version: z.string().optional(),
});

export type DataSource = z.infer<typeof DataSourceSchema>;

// ============================================================================
// Vital Signs
// ============================================================================

export const HeartRateSchema = z.object({
  type: z.literal('heart_rate'),
  value: z.number().min(0).max(300),
  unit: z.literal('bpm'),
  timestamp: TimestampSchema,
  source: DataSourceSchema.optional(),
  context: z.enum(['resting', 'active', 'sleeping', 'recovery', 'unknown']).default('unknown'),
  confidence: z.number().min(0).max(1).optional(),
});

export type HeartRate = z.infer<typeof HeartRateSchema>;

export const BloodPressureSchema = z.object({
  type: z.literal('blood_pressure'),
  systolic: z.number().min(0).max(300),
  diastolic: z.number().min(0).max(200),
  unit: z.literal('mmHg'),
  timestamp: TimestampSchema,
  source: DataSourceSchema.optional(),
  position: z.enum(['sitting', 'standing', 'lying', 'unknown']).default('unknown'),
  arm: z.enum(['left', 'right', 'unknown']).default('unknown'),
});

export type BloodPressure = z.infer<typeof BloodPressureSchema>;

export const BloodOxygenSchema = z.object({
  type: z.literal('blood_oxygen'),
  value: z.number().min(0).max(100),
  unit: z.literal('%'),
  timestamp: TimestampSchema,
  source: DataSourceSchema.optional(),
  measurementType: z.enum(['spot', 'continuous']).default('spot'),
});

export type BloodOxygen = z.infer<typeof BloodOxygenSchema>;

export const BodyTemperatureSchema = z.object({
  type: z.literal('body_temperature'),
  value: z.number().min(30).max(45),
  unit: z.enum(['celsius', 'fahrenheit']),
  timestamp: TimestampSchema,
  source: DataSourceSchema.optional(),
  measurementSite: z.enum(['oral', 'forehead', 'ear', 'armpit', 'wrist', 'unknown']).default('unknown'),
});

export type BodyTemperature = z.infer<typeof BodyTemperatureSchema>;

export const RespiratoryRateSchema = z.object({
  type: z.literal('respiratory_rate'),
  value: z.number().min(0).max(100),
  unit: z.literal('breaths/min'),
  timestamp: TimestampSchema,
  source: DataSourceSchema.optional(),
});

export type RespiratoryRate = z.infer<typeof RespiratoryRateSchema>;

export const HRVSchema = z.object({
  type: z.literal('hrv'),
  rmssd: z.number().min(0).optional(), // Root Mean Square of Successive Differences
  sdnn: z.number().min(0).optional(),  // Standard Deviation of NN intervals
  unit: z.literal('ms'),
  timestamp: TimestampSchema,
  source: DataSourceSchema.optional(),
  duration: z.number().optional(), // measurement duration in seconds
});

export type HRV = z.infer<typeof HRVSchema>;

// ============================================================================
// Activity Data
// ============================================================================

export const StepsSchema = z.object({
  type: z.literal('steps'),
  value: z.number().min(0),
  unit: z.literal('count'),
  startTime: TimestampSchema,
  endTime: TimestampSchema,
  source: DataSourceSchema.optional(),
});

export type Steps = z.infer<typeof StepsSchema>;

export const DistanceSchema = z.object({
  type: z.literal('distance'),
  value: z.number().min(0),
  unit: z.enum(['meters', 'kilometers', 'miles']),
  startTime: TimestampSchema,
  endTime: TimestampSchema,
  source: DataSourceSchema.optional(),
  activityType: z.string().optional(),
});

export type Distance = z.infer<typeof DistanceSchema>;

export const CaloriesSchema = z.object({
  type: z.literal('calories'),
  value: z.number().min(0),
  unit: z.literal('kcal'),
  startTime: TimestampSchema,
  endTime: TimestampSchema,
  source: DataSourceSchema.optional(),
  calorieType: z.enum(['active', 'resting', 'total']).default('total'),
});

export type Calories = z.infer<typeof CaloriesSchema>;

export const WorkoutSchema = z.object({
  type: z.literal('workout'),
  activityType: z.string(),
  startTime: TimestampSchema,
  endTime: TimestampSchema,
  duration: z.number(), // seconds
  calories: z.number().optional(),
  distance: z.number().optional(),
  distanceUnit: z.enum(['meters', 'kilometers', 'miles']).optional(),
  avgHeartRate: z.number().optional(),
  maxHeartRate: z.number().optional(),
  source: DataSourceSchema.optional(),
  metadata: z.record(z.any()).optional(),
});

export type Workout = z.infer<typeof WorkoutSchema>;

// ============================================================================
// Sleep Data
// ============================================================================

export const SleepStageSchema = z.object({
  stage: z.enum(['awake', 'light', 'deep', 'rem', 'unknown']),
  startTime: TimestampSchema,
  endTime: TimestampSchema,
  duration: z.number(), // seconds
});

export type SleepStage = z.infer<typeof SleepStageSchema>;

export const SleepSessionSchema = z.object({
  type: z.literal('sleep'),
  startTime: TimestampSchema,
  endTime: TimestampSchema,
  duration: z.number(), // total seconds
  stages: z.array(SleepStageSchema).optional(),
  efficiency: z.number().min(0).max(100).optional(), // percentage
  awakenings: z.number().optional(),
  source: DataSourceSchema.optional(),
  quality: z.enum(['poor', 'fair', 'good', 'excellent', 'unknown']).optional(),
});

export type SleepSession = z.infer<typeof SleepSessionSchema>;

// ============================================================================
// Body Measurements
// ============================================================================

export const WeightSchema = z.object({
  type: z.literal('weight'),
  value: z.number().min(0),
  unit: z.enum(['kg', 'lbs']),
  timestamp: TimestampSchema,
  source: DataSourceSchema.optional(),
});

export type Weight = z.infer<typeof WeightSchema>;

export const HeightSchema = z.object({
  type: z.literal('height'),
  value: z.number().min(0),
  unit: z.enum(['cm', 'inches']),
  timestamp: TimestampSchema,
  source: DataSourceSchema.optional(),
});

export type Height = z.infer<typeof HeightSchema>;

export const BodyCompositionSchema = z.object({
  type: z.literal('body_composition'),
  bodyFatPercentage: z.number().min(0).max(100).optional(),
  muscleMass: z.number().min(0).optional(),
  muscleMassUnit: z.enum(['kg', 'lbs']).optional(),
  boneMass: z.number().min(0).optional(),
  waterPercentage: z.number().min(0).max(100).optional(),
  timestamp: TimestampSchema,
  source: DataSourceSchema.optional(),
});

export type BodyComposition = z.infer<typeof BodyCompositionSchema>;

// ============================================================================
// Lab Results
// ============================================================================

export const LabResultSchema = z.object({
  type: z.literal('lab_result'),
  testName: z.string(),
  testCode: z.string().optional(), // LOINC code
  value: z.union([z.number(), z.string()]),
  unit: z.string(),
  referenceRange: z.object({
    low: z.number().optional(),
    high: z.number().optional(),
    text: z.string().optional(),
  }).optional(),
  interpretation: z.enum(['normal', 'abnormal', 'critical', 'unknown']).optional(),
  timestamp: TimestampSchema,
  source: DataSourceSchema.optional(),
});

export type LabResult = z.infer<typeof LabResultSchema>;

// ============================================================================
// Nutrition
// ============================================================================

export const NutritionEntrySchema = z.object({
  type: z.literal('nutrition'),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'other']).optional(),
  calories: z.number().min(0).optional(),
  protein: z.number().min(0).optional(), // grams
  carbohydrates: z.number().min(0).optional(), // grams
  fat: z.number().min(0).optional(), // grams
  fiber: z.number().min(0).optional(), // grams
  sugar: z.number().min(0).optional(), // grams
  sodium: z.number().min(0).optional(), // mg
  water: z.number().min(0).optional(), // ml
  timestamp: TimestampSchema,
  source: DataSourceSchema.optional(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number().optional(),
    unit: z.string().optional(),
    calories: z.number().optional(),
  })).optional(),
});

export type NutritionEntry = z.infer<typeof NutritionEntrySchema>;

// ============================================================================
// Unified Health Record
// ============================================================================

export const HealthRecordSchema = z.discriminatedUnion('type', [
  HeartRateSchema,
  BloodPressureSchema,
  BloodOxygenSchema,
  BodyTemperatureSchema,
  RespiratoryRateSchema,
  HRVSchema,
  StepsSchema,
  DistanceSchema,
  CaloriesSchema,
  WorkoutSchema,
  SleepSessionSchema,
  WeightSchema,
  HeightSchema,
  BodyCompositionSchema,
  LabResultSchema,
  NutritionEntrySchema,
]);

export type HealthRecord = z.infer<typeof HealthRecordSchema>;

// ============================================================================
// Health Record Collection (Data Brick)
// ============================================================================

export interface HealthDataBrick {
  id: string;
  userId: string;
  records: HealthRecord[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    source: string;
    version: string;
  };
}
