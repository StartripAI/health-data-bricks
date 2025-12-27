/**
 * Health Data Bricks - FHIR R4 Type Definitions
 *
 * FHIR (Fast Healthcare Interoperability Resources) types for EHR integration
 * Based on FHIR R4 specification
 */

import { z } from 'zod';

// ============================================================================
// FHIR Base Types
// ============================================================================

export const FHIRCodingSchema = z.object({
  system: z.string().optional(),
  version: z.string().optional(),
  code: z.string().optional(),
  display: z.string().optional(),
  userSelected: z.boolean().optional(),
});

export type FHIRCoding = z.infer<typeof FHIRCodingSchema>;

export const FHIRCodeableConceptSchema = z.object({
  coding: z.array(FHIRCodingSchema).optional(),
  text: z.string().optional(),
});

export type FHIRCodeableConcept = z.infer<typeof FHIRCodeableConceptSchema>;

export const FHIRQuantitySchema = z.object({
  value: z.number().optional(),
  comparator: z.enum(['<', '<=', '>=', '>']).optional(),
  unit: z.string().optional(),
  system: z.string().optional(),
  code: z.string().optional(),
});

export type FHIRQuantity = z.infer<typeof FHIRQuantitySchema>;

export const FHIRPeriodSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

export type FHIRPeriod = z.infer<typeof FHIRPeriodSchema>;

export const FHIRReferenceSchema = z.object({
  reference: z.string().optional(),
  type: z.string().optional(),
  display: z.string().optional(),
});

export type FHIRReference = z.infer<typeof FHIRReferenceSchema>;

// ============================================================================
// FHIR Observation (Vitals, Labs)
// ============================================================================

export const FHIRObservationComponentSchema = z.object({
  code: FHIRCodeableConceptSchema,
  valueQuantity: FHIRQuantitySchema.optional(),
  valueCodeableConcept: FHIRCodeableConceptSchema.optional(),
  valueString: z.string().optional(),
  valueBoolean: z.boolean().optional(),
  valueInteger: z.number().optional(),
  interpretation: z.array(FHIRCodeableConceptSchema).optional(),
  referenceRange: z.array(z.object({
    low: FHIRQuantitySchema.optional(),
    high: FHIRQuantitySchema.optional(),
    type: FHIRCodeableConceptSchema.optional(),
    text: z.string().optional(),
  })).optional(),
});

export type FHIRObservationComponent = z.infer<typeof FHIRObservationComponentSchema>;

export const FHIRObservationSchema = z.object({
  resourceType: z.literal('Observation'),
  id: z.string().optional(),
  status: z.enum(['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown']),
  category: z.array(FHIRCodeableConceptSchema).optional(),
  code: FHIRCodeableConceptSchema,
  subject: FHIRReferenceSchema.optional(),
  effectiveDateTime: z.string().optional(),
  effectivePeriod: FHIRPeriodSchema.optional(),
  issued: z.string().optional(),
  performer: z.array(FHIRReferenceSchema).optional(),
  valueQuantity: FHIRQuantitySchema.optional(),
  valueCodeableConcept: FHIRCodeableConceptSchema.optional(),
  valueString: z.string().optional(),
  valueBoolean: z.boolean().optional(),
  valueInteger: z.number().optional(),
  interpretation: z.array(FHIRCodeableConceptSchema).optional(),
  bodySite: FHIRCodeableConceptSchema.optional(),
  method: FHIRCodeableConceptSchema.optional(),
  device: FHIRReferenceSchema.optional(),
  referenceRange: z.array(z.object({
    low: FHIRQuantitySchema.optional(),
    high: FHIRQuantitySchema.optional(),
    type: FHIRCodeableConceptSchema.optional(),
    text: z.string().optional(),
  })).optional(),
  component: z.array(FHIRObservationComponentSchema).optional(),
});

export type FHIRObservation = z.infer<typeof FHIRObservationSchema>;

// ============================================================================
// FHIR Patient
// ============================================================================

export const FHIRPatientSchema = z.object({
  resourceType: z.literal('Patient'),
  id: z.string().optional(),
  identifier: z.array(z.object({
    system: z.string().optional(),
    value: z.string().optional(),
  })).optional(),
  name: z.array(z.object({
    use: z.string().optional(),
    family: z.string().optional(),
    given: z.array(z.string()).optional(),
  })).optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  birthDate: z.string().optional(),
});

export type FHIRPatient = z.infer<typeof FHIRPatientSchema>;

// ============================================================================
// LOINC Codes for Common Observations
// ============================================================================

export const LOINC_CODES = {
  // Vital Signs
  HEART_RATE: '8867-4',
  BLOOD_PRESSURE_SYSTOLIC: '8480-6',
  BLOOD_PRESSURE_DIASTOLIC: '8462-4',
  BLOOD_PRESSURE_PANEL: '85354-9',
  BODY_TEMPERATURE: '8310-5',
  RESPIRATORY_RATE: '9279-1',
  OXYGEN_SATURATION: '2708-6',
  BODY_WEIGHT: '29463-7',
  BODY_HEIGHT: '8302-2',
  BMI: '39156-5',

  // Activity
  STEPS: '55423-8',
  EXERCISE_DURATION: '55411-3',
  CALORIES_BURNED: '41981-2',

  // Sleep
  SLEEP_DURATION: '93832-4',

  // Labs
  GLUCOSE: '2339-0',
  HBA1C: '4548-4',
  CHOLESTEROL_TOTAL: '2093-3',
  HDL: '2085-9',
  LDL: '2089-1',
  TRIGLYCERIDES: '2571-8',
} as const;

// ============================================================================
// FHIR Bundle
// ============================================================================

export const FHIRBundleSchema = z.object({
  resourceType: z.literal('Bundle'),
  id: z.string().optional(),
  type: z.enum(['document', 'message', 'transaction', 'transaction-response', 'batch', 'batch-response', 'history', 'searchset', 'collection']),
  total: z.number().optional(),
  entry: z.array(z.object({
    fullUrl: z.string().optional(),
    resource: z.any(),
    search: z.object({
      mode: z.enum(['match', 'include', 'outcome']).optional(),
      score: z.number().optional(),
    }).optional(),
  })).optional(),
});

export type FHIRBundle = z.infer<typeof FHIRBundleSchema>;
