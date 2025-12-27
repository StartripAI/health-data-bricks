/**
 * Health Data Bricks - Unit Converter
 *
 * Normalizes health data units to standard formats
 */

// ============================================================================
// Temperature Conversions
// ============================================================================

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9/5) + 32;
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return (fahrenheit - 32) * 5/9;
}

export function normalizeTemperature(value: number, fromUnit: 'celsius' | 'fahrenheit', toUnit: 'celsius' | 'fahrenheit'): number {
  if (fromUnit === toUnit) return value;
  return fromUnit === 'celsius' ? celsiusToFahrenheit(value) : fahrenheitToCelsius(value);
}

// ============================================================================
// Weight Conversions
// ============================================================================

export function kgToLbs(kg: number): number {
  return kg * 2.20462;
}

export function lbsToKg(lbs: number): number {
  return lbs / 2.20462;
}

export function normalizeWeight(value: number, fromUnit: 'kg' | 'lbs', toUnit: 'kg' | 'lbs'): number {
  if (fromUnit === toUnit) return value;
  return fromUnit === 'kg' ? kgToLbs(value) : lbsToKg(value);
}

// ============================================================================
// Height/Distance Conversions
// ============================================================================

export function cmToInches(cm: number): number {
  return cm / 2.54;
}

export function inchesToCm(inches: number): number {
  return inches * 2.54;
}

export function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

export function metersToKilometers(meters: number): number {
  return meters / 1000;
}

export function kilometersToMeters(km: number): number {
  return km * 1000;
}

export function normalizeDistance(
  value: number,
  fromUnit: 'meters' | 'kilometers' | 'miles',
  toUnit: 'meters' | 'kilometers' | 'miles'
): number {
  if (fromUnit === toUnit) return value;

  // Convert to meters first
  let meters: number;
  switch (fromUnit) {
    case 'meters': meters = value; break;
    case 'kilometers': meters = kilometersToMeters(value); break;
    case 'miles': meters = milesToMeters(value); break;
  }

  // Convert from meters to target
  switch (toUnit) {
    case 'meters': return meters;
    case 'kilometers': return metersToKilometers(meters);
    case 'miles': return metersToMiles(meters);
  }
}

// ============================================================================
// Energy Conversions
// ============================================================================

export function kcalToKj(kcal: number): number {
  return kcal * 4.184;
}

export function kjToKcal(kj: number): number {
  return kj / 4.184;
}

// ============================================================================
// Time Conversions
// ============================================================================

export function secondsToMinutes(seconds: number): number {
  return seconds / 60;
}

export function minutesToSeconds(minutes: number): number {
  return minutes * 60;
}

export function secondsToHours(seconds: number): number {
  return seconds / 3600;
}

export function hoursToSeconds(hours: number): number {
  return hours * 3600;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// ============================================================================
// Blood Glucose Conversions
// ============================================================================

export function mgdlToMmol(mgdl: number): number {
  return mgdl / 18.0182;
}

export function mmolToMgdl(mmol: number): number {
  return mmol * 18.0182;
}

// ============================================================================
// Generic Unit Normalizer
// ============================================================================

export interface UnitConversionConfig {
  type: 'temperature' | 'weight' | 'distance' | 'height' | 'glucose';
  targetUnit: string;
}

export function createNormalizer(config: UnitConversionConfig) {
  return (value: number, sourceUnit: string): number => {
    switch (config.type) {
      case 'temperature':
        return normalizeTemperature(
          value,
          sourceUnit as 'celsius' | 'fahrenheit',
          config.targetUnit as 'celsius' | 'fahrenheit'
        );
      case 'weight':
        return normalizeWeight(
          value,
          sourceUnit as 'kg' | 'lbs',
          config.targetUnit as 'kg' | 'lbs'
        );
      case 'distance':
        return normalizeDistance(
          value,
          sourceUnit as 'meters' | 'kilometers' | 'miles',
          config.targetUnit as 'meters' | 'kilometers' | 'miles'
        );
      default:
        return value;
    }
  };
}
