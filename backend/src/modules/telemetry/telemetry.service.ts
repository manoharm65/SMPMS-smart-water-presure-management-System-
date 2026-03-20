import { eventBus, TelemetryPayload } from '../../core/event-bus.js';
import { telemetryRepository } from '../../repositories/telemetry.repository.js';
import { nodeRepository } from '../../repositories/node.repository.js';
import { CreateTelemetryDto } from './dto/create-telemetry.dto.js';
import { Telemetry } from '../../types/index.js';

export class TelemetryService {
  async create(dto: CreateTelemetryDto): Promise<Telemetry> {
    // Check if node exists
    const node = nodeRepository.findByNodeId(dto.nodeId);
    if (!node) {
      throw new Error(`Node ${dto.nodeId} not found`);
    }

    // Store telemetry
    const telemetry = telemetryRepository.create({
      nodeId: dto.nodeId,
      pressure: dto.pressure,
      flowRate: dto.flowRate,
      temperature: dto.temperature,
      batteryLevel: dto.batteryLevel,
    });

    console.log(`[Telemetry] Received: node=${dto.nodeId}, pressure=${dto.pressure}`);

    // Emit telemetry received event
    const payload: TelemetryPayload = {
      nodeId: dto.nodeId,
      pressure: dto.pressure,
      flowRate: dto.flowRate,
      temperature: dto.temperature,
      batteryLevel: dto.batteryLevel,
      timestamp: new Date(),
      telemetryId: telemetry.id,
    };

    eventBus.emitTelemetryReceived(payload);

    return telemetry;
  }

  getLatestByNodeId(nodeId: string, limit = 10): Telemetry[] {
    return telemetryRepository.findLatestByNodeId(nodeId, limit);
  }

  getLatest(): Telemetry[] {
    return telemetryRepository.findLatest();
  }

  getByNodeId(nodeId: string, limit = 100): Telemetry[] {
    return telemetryRepository.findByNodeId(nodeId, limit);
  }
}

export const telemetryService = new TelemetryService();
