import { z } from 'zod';

/**
 * Zod schema for ESP telemetry payloads — second validation layer after class-validator.
 * More precise than class-validator for external/untrusted input.
 */

// DMA_ followed by uppercase letters and numbers, minimum DMA_0 (4 chars total)
const DMA_ID_PATTERN = /^DMA_[A-Z0-9]{1,20}$/;

export const CreateEspTelemetrySchema = z.object({
  nodeId: z.string().regex(DMA_ID_PATTERN, 'nodeId must match DMA_XXX format (e.g., DMA_01)'),
  pressure: z.number().min(0, 'Pressure cannot be negative').max(20, 'Pressure cannot exceed 20 BAR'),
  valvePosition: z
    .number()
    .min(0, 'Valve position minimum is 0')
    .max(100, 'Valve position maximum is 100')
    .int('Valve position must be an integer'),
  timestamp: z.string().datetime({ message: 'Timestamp must be ISO 8601 format' }),
});

export const SyncTelemetrySchema = z.object({
  nodeId: z.string().regex(DMA_ID_PATTERN, 'nodeId must match DMA_XXX format (e.g., DMA_01)'),
  readings: z
    .array(
      z.object({
        pressure: z.number().min(0).max(20),
        valvePosition: z.number().min(0).max(100).int(),
        timestamp: z.string().datetime(),
      })
    )
    .min(1, 'At least one reading is required')
    .max(1000, 'Maximum 1000 readings per sync'),
});

export const RegisterEspSchema = z.object({
  nodeId: z.string().regex(DMA_ID_PATTERN, 'nodeId must match DMA_XXX format (e.g., DMA_01)'),
  firmwareVersion: z.string().min(1, 'Firmware version is required'),
  ipAddress: z.ipv4(),
});

export type CreateEspTelemetryInput = z.infer<typeof CreateEspTelemetrySchema>;
export type SyncTelemetryInput = z.infer<typeof SyncTelemetrySchema>;
export type RegisterEspInput = z.infer<typeof RegisterEspSchema>;

/**
 * Validate an ESP payload with Zod, returning the parsed data or throwing a descriptive error.
 */
export function validateEspTelemetry(payload: unknown) {
  return CreateEspTelemetrySchema.parse(payload);
}

export function validateSyncTelemetry(payload: unknown) {
  return SyncTelemetrySchema.parse(payload);
}

export function validateRegisterEsp(payload: unknown) {
  return RegisterEspSchema.parse(payload);
}
