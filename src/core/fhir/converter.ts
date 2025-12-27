/**
 * Health Data Bricks - FHIR Converter
 *
 * Bidirectional conversion between internal HealthRecord format and FHIR R4
 */

import {
  FHIRObservation,
  FHIRQuantity,
  FHIRCodeableConcept,
  LOINC_CODES,
} from './types';
import {
  HealthRecord,
  HeartRate,
  BloodPressure,
  BloodOxygen,
  BodyTemperature,
  Weight,
  Height,
  Steps,
} from '../types/health-record';

// ============================================================================
// Internal to FHIR Conversion
// ============================================================================

export function healthRecordToFHIR(record: HealthRecord, patientId?: string): FHIRObservation | null {
  switch (record.type) {
    case 'heart_rate':
      return heartRateToFHIR(record, patientId);
    case 'blood_pressure':
      return bloodPressureToFHIR(record, patientId);
    case 'blood_oxygen':
      return bloodOxygenToFHIR(record, patientId);
    case 'body_temperature':
      return bodyTemperatureToFHIR(record, patientId);
    case 'weight':
      return weightToFHIR(record, patientId);
    case 'height':
      return heightToFHIR(record, patientId);
    case 'steps':
      return stepsToFHIR(record, patientId);
    default:
      return null;
  }
}

function heartRateToFHIR(record: HeartRate, patientId?: string): FHIRObservation {
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [vitalSignsCategory()],
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: LOINC_CODES.HEART_RATE,
        display: 'Heart rate',
      }],
      text: 'Heart Rate',
    },
    subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
    effectiveDateTime: record.timestamp.datetime,
    valueQuantity: {
      value: record.value,
      unit: 'beats/minute',
      system: 'http://unitsofmeasure.org',
      code: '/min',
    },
  };
}

function bloodPressureToFHIR(record: BloodPressure, patientId?: string): FHIRObservation {
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [vitalSignsCategory()],
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: LOINC_CODES.BLOOD_PRESSURE_PANEL,
        display: 'Blood pressure panel',
      }],
      text: 'Blood Pressure',
    },
    subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
    effectiveDateTime: record.timestamp.datetime,
    component: [
      {
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: LOINC_CODES.BLOOD_PRESSURE_SYSTOLIC,
            display: 'Systolic blood pressure',
          }],
        },
        valueQuantity: {
          value: record.systolic,
          unit: 'mmHg',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]',
        },
      },
      {
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: LOINC_CODES.BLOOD_PRESSURE_DIASTOLIC,
            display: 'Diastolic blood pressure',
          }],
        },
        valueQuantity: {
          value: record.diastolic,
          unit: 'mmHg',
          system: 'http://unitsofmeasure.org',
          code: 'mm[Hg]',
        },
      },
    ],
  };
}

function bloodOxygenToFHIR(record: BloodOxygen, patientId?: string): FHIRObservation {
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [vitalSignsCategory()],
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: LOINC_CODES.OXYGEN_SATURATION,
        display: 'Oxygen saturation',
      }],
      text: 'Blood Oxygen Saturation',
    },
    subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
    effectiveDateTime: record.timestamp.datetime,
    valueQuantity: {
      value: record.value,
      unit: '%',
      system: 'http://unitsofmeasure.org',
      code: '%',
    },
  };
}

function bodyTemperatureToFHIR(record: BodyTemperature, patientId?: string): FHIRObservation {
  const isCelsius = record.unit === 'celsius';
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [vitalSignsCategory()],
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: LOINC_CODES.BODY_TEMPERATURE,
        display: 'Body temperature',
      }],
      text: 'Body Temperature',
    },
    subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
    effectiveDateTime: record.timestamp.datetime,
    valueQuantity: {
      value: record.value,
      unit: isCelsius ? 'Cel' : '[degF]',
      system: 'http://unitsofmeasure.org',
      code: isCelsius ? 'Cel' : '[degF]',
    },
  };
}

function weightToFHIR(record: Weight, patientId?: string): FHIRObservation {
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [vitalSignsCategory()],
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: LOINC_CODES.BODY_WEIGHT,
        display: 'Body weight',
      }],
      text: 'Body Weight',
    },
    subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
    effectiveDateTime: record.timestamp.datetime,
    valueQuantity: {
      value: record.value,
      unit: record.unit,
      system: 'http://unitsofmeasure.org',
      code: record.unit,
    },
  };
}

function heightToFHIR(record: Height, patientId?: string): FHIRObservation {
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [vitalSignsCategory()],
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: LOINC_CODES.BODY_HEIGHT,
        display: 'Body height',
      }],
      text: 'Body Height',
    },
    subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
    effectiveDateTime: record.timestamp.datetime,
    valueQuantity: {
      value: record.value,
      unit: record.unit,
      system: 'http://unitsofmeasure.org',
      code: record.unit,
    },
  };
}

function stepsToFHIR(record: Steps, patientId?: string): FHIRObservation {
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [activityCategory()],
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: LOINC_CODES.STEPS,
        display: 'Number of steps',
      }],
      text: 'Step Count',
    },
    subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
    effectivePeriod: {
      start: record.startTime.datetime,
      end: record.endTime.datetime,
    },
    valueQuantity: {
      value: record.value,
      unit: 'steps',
      system: 'http://unitsofmeasure.org',
      code: '{steps}',
    },
  };
}

// ============================================================================
// FHIR to Internal Conversion
// ============================================================================

export function fhirToHealthRecord(observation: FHIRObservation): HealthRecord | null {
  const loincCode = observation.code.coding?.find(c => c.system === 'http://loinc.org')?.code;

  if (!loincCode) {
    return null;
  }

  const datetime = observation.effectiveDateTime || new Date().toISOString();

  switch (loincCode) {
    case LOINC_CODES.HEART_RATE:
      return {
        type: 'heart_rate',
        value: observation.valueQuantity?.value || 0,
        unit: 'bpm',
        timestamp: { datetime, source: 'system' },
        context: 'unknown',
      };

    case LOINC_CODES.BLOOD_PRESSURE_PANEL:
      const systolic = observation.component?.find(
        c => c.code.coding?.some(coding => coding.code === LOINC_CODES.BLOOD_PRESSURE_SYSTOLIC)
      )?.valueQuantity?.value;
      const diastolic = observation.component?.find(
        c => c.code.coding?.some(coding => coding.code === LOINC_CODES.BLOOD_PRESSURE_DIASTOLIC)
      )?.valueQuantity?.value;
      return {
        type: 'blood_pressure',
        systolic: systolic || 0,
        diastolic: diastolic || 0,
        unit: 'mmHg',
        timestamp: { datetime, source: 'system' },
        position: 'unknown',
        arm: 'unknown',
      };

    case LOINC_CODES.OXYGEN_SATURATION:
      return {
        type: 'blood_oxygen',
        value: observation.valueQuantity?.value || 0,
        unit: '%',
        timestamp: { datetime, source: 'system' },
        measurementType: 'spot',
      };

    case LOINC_CODES.BODY_WEIGHT:
      return {
        type: 'weight',
        value: observation.valueQuantity?.value || 0,
        unit: observation.valueQuantity?.code === 'lbs' ? 'lbs' : 'kg',
        timestamp: { datetime, source: 'system' },
      };

    case LOINC_CODES.BODY_HEIGHT:
      return {
        type: 'height',
        value: observation.valueQuantity?.value || 0,
        unit: observation.valueQuantity?.code === 'inches' ? 'inches' : 'cm',
        timestamp: { datetime, source: 'system' },
      };

    default:
      return null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function vitalSignsCategory(): FHIRCodeableConcept {
  return {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/observation-category',
      code: 'vital-signs',
      display: 'Vital Signs',
    }],
  };
}

function activityCategory(): FHIRCodeableConcept {
  return {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/observation-category',
      code: 'activity',
      display: 'Activity',
    }],
  };
}

// ============================================================================
// Batch Conversion
// ============================================================================

export function healthRecordsToFHIRBundle(records: HealthRecord[], patientId?: string) {
  const observations = records
    .map(r => healthRecordToFHIR(r, patientId))
    .filter((o): o is FHIRObservation => o !== null);

  return {
    resourceType: 'Bundle' as const,
    type: 'collection' as const,
    total: observations.length,
    entry: observations.map((resource, index) => ({
      fullUrl: `urn:uuid:${index}`,
      resource,
    })),
  };
}
