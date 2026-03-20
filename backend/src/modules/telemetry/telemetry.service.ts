import { eventBus, TelemetryPayload, CommandAckPayload } from '../../core/event-bus.js';
import { telemetryRepository } from '../../repositories/telemetry.repository.js';
import { nodeRepository } from '../../repositories/node.repository.js';
import { commandRepository } from '../../repositories/command.repository.js';
import { CreateTelemetryDto } from './dto/create-telemetry.dto.js';
import { Telemetry, Command } from '../../types/index.js';
import { config } from '../../core/config.js';

export class TelemetryService {
  async create(dto: CreateTelemetryDto): Promise<{ telemetry: Telemetry; command?: Command }> {
    // Check if node exists
    const node = nodeRepository.findByNodeId(dto.nodeId);
    if (!node) {
      throw new Error(`Node ${dto.nodeId} not found`);
    }

    // Handle ACK from ESP if included in payload
    if (dto.ack) {
      const ackPayload: CommandAckPayload = {
        nodeId: dto.nodeId,
        commandId: dto.ack.commandId,
        executed: dto.ack.executed === 1,
        actualPosition: dto.ack.actualPosition,
        timestamp: new Date(),
      };
      eventBus.emitCommandAckReceived(ackPayload);
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

    // Emit telemetry received event (triggers decision engine)
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

    // Check for pending command to dispatch to ESP
    const pendingCommand = commandRepository.findOldestPendingByNodeId(dto.nodeId);
    let commandToDispatch: Command | undefined;
    if (pendingCommand) {
      commandRepository.updateStatus(pendingCommand.id, 'DISPATCHED');
      commandToDispatch = pendingCommand;
    }

    return { telemetry, command: commandToDispatch };
  }

  async createForEsp(dto: { nodeId: string; pressure: number; valvePosition: number; timestamp: string }): Promise<{
    received: boolean;
    command: null | { command_id: string; type: 'SET_VALVE'; value: number };
  }> {
    // Check if node exists
    const node = nodeRepository.findByNodeId(dto.nodeId);
    if (!node) {
      throw new Error(`Node ${dto.nodeId} not found`);
    }

    // Store telemetry
    telemetryRepository.create({
      nodeId: dto.nodeId,
      pressure: dto.pressure,
      valvePosition: dto.valvePosition,
      timestamp: dto.timestamp,
    });

    // Update node last_seen and set status to online
    nodeRepository.updateStatusAndLastSeen(dto.nodeId, 'online', dto.timestamp);

    // Emit telemetry received event
    const payload: TelemetryPayload = {
      nodeId: dto.nodeId,
      pressure: dto.pressure,
      timestamp: new Date(dto.timestamp),
    };
    eventBus.emitTelemetryReceived(payload);

    // Check for pending command to piggyback
    const pendingCommand = commandRepository.findOldestPendingByNodeId(dto.nodeId);

    if (pendingCommand) {
      // Mark as dispatched and return it
      commandRepository.updateStatus(pendingCommand.id, 'DISPATCHED');
      return {
        received: true,
        command: {
          command_id: pendingCommand.id,
          type: 'SET_VALVE',
          value: pendingCommand.targetPosition ?? 0,
        },
      };
    }

    return { received: true, command: null };
  }

  async syncBuffered(dto: { nodeId: string; readings: { pressure: number; valvePosition: number; timestamp: string }[] }): Promise<number> {
    const node = nodeRepository.findByNodeId(dto.nodeId);
    if (!node) {
      throw new Error(`Node ${dto.nodeId} not found`);
    }

    const synced = telemetryRepository.createBulk(
      dto.readings.map(r => ({
        nodeId: dto.nodeId,
        pressure: r.pressure,
        valvePosition: r.valvePosition,
        timestamp: r.timestamp,
      }))
    );

    // Update last_seen to most recent reading
    if (dto.readings.length > 0) {
      const latestReading = dto.readings[dto.readings.length - 1];
      nodeRepository.updateStatusAndLastSeen(dto.nodeId, 'online', latestReading.timestamp);
    }

    console.log(`[Telemetry] Synced ${synced} buffered readings for node ${dto.nodeId}`);
    return synced;
  }

  checkAllNodesStatus(): void {
    const nodes = nodeRepository.findAll();
    for (const node of nodes) {
      nodeRepository.checkNodeStatus(node.nodeId, config.telemetryIntervalMs);
    }
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
