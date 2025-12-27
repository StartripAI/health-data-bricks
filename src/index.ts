/**
 * Health Data Bricks
 *
 * AI-Native Health Data Infrastructure
 * Modular data bricks for health applications
 *
 * Architecture:
 * - Layer 1 (Core): Health data types, FHIR interoperability, normalizers
 * - Layer 2 (Platform): Data pipelines, aggregators, analytics
 * - Layer 3 (Application): MCP server for AI integration
 */

// ============================================================================
// Core Layer Exports
// ============================================================================

// Types
export * from './core/types/health-record';

// FHIR
export * from './core/fhir/types';
export * from './core/fhir/converter';

// Normalizers
export * from './core/normalizers/unit-converter';
export * from './core/normalizers/data-normalizer';

// Physics (USMK-inspired)
export * from './core/physics/surprise-filter';
export * from './core/physics/continuous-dynamics';
export * from './core/physics/intervention-planner';

// ============================================================================
// Platform Layer Exports
// ============================================================================

// Pipelines
export * from './platform/pipelines/data-pipeline';

// Aggregators
export * from './platform/aggregators/time-aggregator';

// Analytics
export * from './platform/analytics/health-analytics';

// ============================================================================
// Parser Exports
// ============================================================================

export * from './parsers/apple-health/parser';
export * from './parsers/fitbit/parser';
export * from './parsers/garmin/parser';

// ============================================================================
// MCP Server Exports
// ============================================================================

export * from './mcp/server';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';
