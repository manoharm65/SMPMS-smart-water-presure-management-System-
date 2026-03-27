import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelemetryService } from './telemetry.service.js';
import { eventBus } from '../../core/event-bus.js';

// Mock repositories
vi.mock('../../repositories/telemetry.repository.js', () => ({
  telemetryRepository: {
    create: vi.fn(),
    createBulk: vi.fn(),
    findById: vi.fn(),
    findLatestByNodeId: vi.fn(),
    findLatest: vi.fn(),
    findByNodeId: vi.fn(),
  },
}));

vi.mock('../../repositories/node.repository.js', () => ({
  nodeRepository: {
    findByNodeId: vi.fn(),
    findAll: vi.fn(),
    updateStatusAndLastSeen: vi.fn(),
    checkNodeStatus: vi.fn(),
  },
}));

vi.mock('../../repositories/command.repository.js', () => ({
  commandRepository: {
    findOldestPendingByNodeId: vi.fn(),
    updateStatus: vi.fn(),
    findPendingByNodeId: vi.fn(),
  },
}));

// Import after mocking
import { telemetryRepository } from '../../repositories/telemetry.repository.js';
import { nodeRepository } from '../../repositories/node.repository.js';
import { commandRepository } from '../../repositories/command.repository.js';

describe('TelemetryService', () => {
  let service: TelemetryService;

  const mockNode = {
    id: 'node-uuid-1',
    nodeId: 'ESP-001',
    name: 'Test Node',
    location: 'Test Location',
    isActive: true,
    valvePosition: 50,
    valveMode: 'auto' as const,
    currentPosition: 50,
    targetPosition: 0,
    status: 'online' as const,
    lastSeen: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTelemetry = {
    id: 'telemetry-uuid-1',
    nodeId: 'ESP-001',
    pressure: 3.5,
    flowRate: 10,
    temperature: 25,
    batteryLevel: 85,
    valvePosition: 50,
    timestamp: new Date().toISOString(),
  };

  const mockPendingCommand = {
    id: 'cmd-uuid-1',
    nodeId: 'ESP-001',
    command: 'SET_VALVE',
    status: 'PENDING',
    priority: 'normal' as const,
    targetPosition: 75,
    sentAt: undefined,
    acknowledgedAt: undefined,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TelemetryService();

    // Default: node exists
    vi.mocked(nodeRepository.findByNodeId).mockReturnValue(mockNode);
    // Default: no pending command
    vi.mocked(commandRepository.findOldestPendingByNodeId).mockReturnValue(null);
  });

  describe('create()', () => {
    it('1. stores telemetry by calling telemetryRepository.create() with correct data', async () => {
      vi.mocked(telemetryRepository.create).mockReturnValue(mockTelemetry);

      const dto = {
        nodeId: 'ESP-001',
        pressure: 3.5,
        flowRate: 10,
        temperature: 25,
        batteryLevel: 85,
      };

      const result = await service.create(dto);

      expect(telemetryRepository.create).toHaveBeenCalledOnce();
      expect(telemetryRepository.create).toHaveBeenCalledWith({
        nodeId: 'ESP-001',
        pressure: 3.5,
        flowRate: 10,
        temperature: 25,
        batteryLevel: 85,
      });
      expect(result.telemetry).toEqual(mockTelemetry);
    });

    it('2. emits TELEMETRY_RECEIVED event on eventBus after storing', async () => {
      vi.mocked(telemetryRepository.create).mockReturnValue(mockTelemetry);
      const emitSpy = vi.spyOn(eventBus, 'emitTelemetryReceived');

      const dto = {
        nodeId: 'ESP-001',
        pressure: 3.5,
      };

      await service.create(dto);

      expect(emitSpy).toHaveBeenCalledOnce();
      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'ESP-001',
          pressure: 3.5,
          telemetryId: mockTelemetry.id,
        })
      );
    });

    it('3. emits command:ack-received event when dto.ack is provided (fire-and-forget)', async () => {
      vi.mocked(telemetryRepository.create).mockReturnValue(mockTelemetry);
      const emitAckSpy = vi.spyOn(eventBus, 'emitCommandAckReceived');

      const dto = {
        nodeId: 'ESP-001',
        pressure: 3.5,
        ack: {
          commandId: 'cmd-ack-123',
          executed: 1,
          actualPosition: 75,
        },
      };

      // Should not await the emit — just call it
      await service.create(dto);

      expect(emitAckSpy).toHaveBeenCalledOnce();
      expect(emitAckSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'ESP-001',
          commandId: 'cmd-ack-123',
          executed: true,
          actualPosition: 75,
        })
      );
    });

    it('4. when a PENDING command exists, marks it DISPATCHED and returns it', async () => {
      vi.mocked(telemetryRepository.create).mockReturnValue(mockTelemetry);
      vi.mocked(commandRepository.findOldestPendingByNodeId).mockReturnValue(mockPendingCommand);

      const dto = {
        nodeId: 'ESP-001',
        pressure: 3.5,
      };

      const result = await service.create(dto);

      expect(commandRepository.updateStatus).toHaveBeenCalledWith('cmd-uuid-1', 'DISPATCHED');
      expect(result.command).toEqual(mockPendingCommand);
    });

    it('throws error when node is not found', async () => {
      vi.mocked(nodeRepository.findByNodeId).mockReturnValue(null);

      const dto = {
        nodeId: 'UNKNOWN-NODE',
        pressure: 3.5,
      };

      await expect(service.create(dto)).rejects.toThrow('Node UNKNOWN-NODE not found');
    });
  });

  describe('createForEsp()', () => {
    it('5. stores telemetry including valvePosition from ESP', async () => {
      vi.mocked(telemetryRepository.create).mockReturnValue(mockTelemetry);

      const dto = {
        nodeId: 'ESP-001',
        pressure: 3.5,
        valvePosition: 60,
        timestamp: '2024-01-15T10:30:00.000Z',
      };

      await service.createForEsp(dto);

      expect(telemetryRepository.create).toHaveBeenCalledWith({
        nodeId: 'ESP-001',
        pressure: 3.5,
        valvePosition: 60,
        timestamp: '2024-01-15T10:30:00.000Z',
      });
    });

    it('6. returns pending command in response as { command_id, type, value }', async () => {
      const commandWithTarget = { ...mockPendingCommand, targetPosition: 75 };
      vi.mocked(commandRepository.findOldestPendingByNodeId).mockReturnValue(commandWithTarget);
      vi.mocked(telemetryRepository.create).mockReturnValue(mockTelemetry);

      const dto = {
        nodeId: 'ESP-001',
        pressure: 3.5,
        valvePosition: 60,
        timestamp: '2024-01-15T10:30:00.000Z',
      };

      const result = await service.createForEsp(dto);

      expect(result.command).toEqual({
        command_id: 'cmd-uuid-1',
        type: 'SET_VALVE',
        value: 75,
      });
    });

    it('7. when no pending command, returns null for command field', async () => {
      vi.mocked(commandRepository.findOldestPendingByNodeId).mockReturnValue(null);
      vi.mocked(telemetryRepository.create).mockReturnValue(mockTelemetry);

      const dto = {
        nodeId: 'ESP-001',
        pressure: 3.5,
        valvePosition: 60,
        timestamp: '2024-01-15T10:30:00.000Z',
      };

      const result = await service.createForEsp(dto);

      expect(result.command).toBeNull();
      expect(result.received).toBe(true);
    });

    it('8. updates node status to online and last_seen', async () => {
      vi.mocked(telemetryRepository.create).mockReturnValue(mockTelemetry);

      const dto = {
        nodeId: 'ESP-001',
        pressure: 3.5,
        valvePosition: 60,
        timestamp: '2024-01-15T10:30:00.000Z',
      };

      await service.createForEsp(dto);

      expect(nodeRepository.updateStatusAndLastSeen).toHaveBeenCalledWith(
        'ESP-001',
        'online',
        '2024-01-15T10:30:00.000Z'
      );
    });

    it('throws error when node is not found', async () => {
      vi.mocked(nodeRepository.findByNodeId).mockReturnValue(null);

      const dto = {
        nodeId: 'UNKNOWN-NODE',
        pressure: 3.5,
        valvePosition: 60,
        timestamp: '2024-01-15T10:30:00.000Z',
      };

      await expect(service.createForEsp(dto)).rejects.toThrow('Node UNKNOWN-NODE not found');
    });

    it('9. emits TELEMETRY_RECEIVED event after storing telemetry', async () => {
      vi.mocked(telemetryRepository.create).mockReturnValue(mockTelemetry);
      const emitSpy = vi.spyOn(eventBus, 'emitTelemetryReceived');

      const dto = {
        nodeId: 'ESP-001',
        pressure: 3.5,
        valvePosition: 60,
        timestamp: '2024-01-15T10:30:00.000Z',
      };

      await service.createForEsp(dto);

      expect(emitSpy).toHaveBeenCalledOnce();
      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'ESP-001',
          pressure: 3.5,
        })
      );
    });
  });

  describe('syncBuffered()', () => {
    it('9. calls telemetryRepository.createBulk() with all readings', async () => {
      vi.mocked(telemetryRepository.createBulk).mockReturnValue(3);

      const dto = {
        nodeId: 'ESP-001',
        readings: [
          { pressure: 3.0, valvePosition: 50, timestamp: '2024-01-15T10:00:00.000Z' },
          { pressure: 3.2, valvePosition: 52, timestamp: '2024-01-15T10:01:00.000Z' },
          { pressure: 3.4, valvePosition: 54, timestamp: '2024-01-15T10:02:00.000Z' },
        ],
      };

      await service.syncBuffered(dto);

      expect(telemetryRepository.createBulk).toHaveBeenCalledOnce();
      expect(telemetryRepository.createBulk).toHaveBeenCalledWith([
        { nodeId: 'ESP-001', pressure: 3.0, valvePosition: 50, timestamp: '2024-01-15T10:00:00.000Z' },
        { nodeId: 'ESP-001', pressure: 3.2, valvePosition: 52, timestamp: '2024-01-15T10:01:00.000Z' },
        { nodeId: 'ESP-001', pressure: 3.4, valvePosition: 54, timestamp: '2024-01-15T10:02:00.000Z' },
      ]);
    });

    it('10. returns the number of readings synced', async () => {
      vi.mocked(telemetryRepository.createBulk).mockReturnValue(3);

      const dto = {
        nodeId: 'ESP-001',
        readings: [
          { pressure: 3.0, valvePosition: 50, timestamp: '2024-01-15T10:00:00.000Z' },
          { pressure: 3.2, valvePosition: 52, timestamp: '2024-01-15T10:01:00.000Z' },
          { pressure: 3.4, valvePosition: 54, timestamp: '2024-01-15T10:02:00.000Z' },
        ],
      };

      const result = await service.syncBuffered(dto);

      expect(result).toBe(3);
    });

    it('11. does NOT emit telemetry:received event (decision engine not triggered)', async () => {
      vi.mocked(telemetryRepository.createBulk).mockReturnValue(3);
      const emitSpy = vi.spyOn(eventBus, 'emitTelemetryReceived');

      const dto = {
        nodeId: 'ESP-001',
        readings: [
          { pressure: 3.0, valvePosition: 50, timestamp: '2024-01-15T10:00:00.000Z' },
        ],
      };

      await service.syncBuffered(dto);

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('updates last_seen to most recent reading', async () => {
      vi.mocked(telemetryRepository.createBulk).mockReturnValue(2);

      const dto = {
        nodeId: 'ESP-001',
        readings: [
          { pressure: 3.0, valvePosition: 50, timestamp: '2024-01-15T10:00:00.000Z' },
          { pressure: 3.5, valvePosition: 55, timestamp: '2024-01-15T10:05:00.000Z' },
        ],
      };

      await service.syncBuffered(dto);

      expect(nodeRepository.updateStatusAndLastSeen).toHaveBeenCalledWith(
        'ESP-001',
        'online',
        '2024-01-15T10:05:00.000Z'
      );
    });

    it('throws error when node is not found', async () => {
      vi.mocked(nodeRepository.findByNodeId).mockReturnValue(null);

      const dto = {
        nodeId: 'UNKNOWN-NODE',
        readings: [
          { pressure: 3.0, valvePosition: 50, timestamp: '2024-01-15T10:00:00.000Z' },
        ],
      };

      await expect(service.syncBuffered(dto)).rejects.toThrow('Node UNKNOWN-NODE not found');
    });
  });
});
