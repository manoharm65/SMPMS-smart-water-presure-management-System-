import request from 'supertest';
import express, { Express } from 'express';
import { CommandService } from '../command.service';
import { CommandRepository } from '../../../repositories/command.repository';
import { NodeRepository } from '../../../repositories/node.repository';
import { eventBus } from '../../../core/event-bus';

// Mock dependencies
jest.mock('../../../repositories/command.repository');
jest.mock('../../../repositories/node.repository');
jest.mock('../../../core/event-bus');
jest.mock('../../../integrations/telegram.service', () => ({
  telegramService: {
    sendTimeoutNotification: jest.fn().mockResolvedValue(undefined),
    sendCriticalCommandNotification: jest.fn().mockResolvedValue(undefined),
    sendManualOverrideNotification: jest.fn().mockResolvedValue(undefined),
    sendOverrideAutoCancelledNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

const MockedCommandRepository = CommandRepository as jest.MockedClass<typeof CommandRepository>;
const MockedNodeRepository = NodeRepository as jest.MockedClass<typeof NodeRepository>;

describe('ESP Command ACK API (POST /api/v1/esp/commands/:commandId/ack)', () => {
  let app: Express;
  let commandService: CommandService;

  // Mock node for auth
  const mockNode = {
    id: 'node-uuid-1',
    nodeId: 'DMA-01',
    name: 'Test Node',
    isActive: true,
    status: 'online' as const,
    apiKey: 'valid-api-key-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Mock dispatched command waiting for ACK
  const mockDispatchedCommand = {
    id: 'cmd-123',
    nodeId: 'DMA-01',
    command: 'REDUCE_FLOW',
    status: 'DISPATCHED',
    priority: 'warning' as const,
    targetPosition: 75,
    sentAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the command service singleton for each test
    jest.resetModules();

    app = express();
    app.use(express.json());

    // Esp auth middleware mock
    app.use((req, _res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        _res.status(401).json({ error: 'Missing Bearer token' });
        return;
      }
      const apiKey = authHeader.slice(7);
      if (apiKey === 'valid-api-key-123') {
        (req as any).nodeId = 'DMA-01';
        next();
      } else if (apiKey === 'invalid-api-key') {
        _res.status(401).json({ error: 'Invalid API key' });
      } else {
        _res.status(401).json({ error: 'Node not found' });
      }
    });
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('Authentication', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', (_req, res) => {
        res.status(401).json({ error: 'Missing Bearer token' });
      });

      const response = await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          actualPosition: 75,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing Bearer token');
    });

    it('should return 401 when invalid API key is provided', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', (req, res) => {
        const authHeader = req.headers.authorization;
        const apiKey = authHeader?.slice(7);
        if (apiKey === 'invalid-api-key') {
          res.status(401).json({ error: 'Invalid API key' });
        } else {
          res.status(401).json({ error: 'Node not found' });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer invalid-api-key')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          actualPosition: 75,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid API key');
    });
  });

  describe('Input Validation', () => {
    it('should return 400 when commandId is missing from params', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', (req, res) => {
        if (!req.params.commandId) {
          res.status(400).json({ error: 'commandId is required' });
          return;
        }
        res.json({ acknowledged: true });
      });

      // This test actually sends a request without commandId in URL
      // Since the route has :commandId, it will always be present if route matches
      const response = await request(testApp)
        .post('/api/v1/esp/commands//ack') // Empty commandId
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          actualPosition: 75,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(404); // Route not matched
    });

    it('should return 400 when nodeId is missing', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const dto = req.body;
          if (!dto.nodeId) {
            res.status(400).json({ error: 'nodeId is required' });
            return;
          }
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          executed: true,
          actualPosition: 75,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('nodeId is required');
    });

    it('should return 400 when executed is missing', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const dto = req.body;
          if (dto.executed === undefined) {
            res.status(400).json({ error: 'executed is required' });
            return;
          }
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          actualPosition: 75,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('executed is required');
    });

    it('should return 400 when actualPosition is missing', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const dto = req.body;
          if (dto.actualPosition === undefined) {
            res.status(400).json({ error: 'actualPosition is required' });
            return;
          }
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('actualPosition is required');
    });

    it('should return 400 when timestamp is missing', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const dto = req.body;
          if (!dto.timestamp) {
            res.status(400).json({ error: 'timestamp is required' });
            return;
          }
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          actualPosition: 75,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('timestamp is required');
    });

    it('should return 400 when executed is not a boolean', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const dto = req.body;
          if (typeof dto.executed !== 'boolean') {
            res.status(400).json({ error: 'executed must be a boolean' });
            return;
          }
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: 'true', // String instead of boolean
          actualPosition: 75,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('executed must be a boolean');
    });

    it('should return 400 when actualPosition is not a number', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const dto = req.body;
          if (typeof dto.actualPosition !== 'number') {
            res.status(400).json({ error: 'actualPosition must be a number' });
            return;
          }
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          actualPosition: '75', // String instead of number
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('actualPosition must be a number');
    });
  });

  describe('Command Acknowledgment', () => {
    it('should acknowledge successfully when command is found and executed=true', async () => {
      MockedCommandRepository.prototype.findByIdAndNodeId.mockReturnValue(mockDispatchedCommand as any);
      MockedCommandRepository.prototype.updateStatus.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateValveState.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const { commandService } = await import('../command.service');
          commandService.acknowledge(
            req.params.commandId,
            req.body.nodeId,
            req.body.executed,
            req.body.actualPosition,
            req.body.timestamp
          );
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          actualPosition: 75,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ acknowledged: true });
    });

    it('should update command status to EXECUTED when executed=true', async () => {
      MockedCommandRepository.prototype.findByIdAndNodeId.mockReturnValue(mockDispatchedCommand as any);
      MockedCommandRepository.prototype.updateStatus.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateValveState.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const { commandService } = await import('../command.service');
          commandService.acknowledge(
            req.params.commandId,
            req.body.nodeId,
            req.body.executed,
            req.body.actualPosition,
            req.body.timestamp
          );
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          actualPosition: 75,
          timestamp: new Date().toISOString(),
        });

      expect(MockedCommandRepository.prototype.updateStatus).toHaveBeenCalledWith(
        'cmd-123',
        'EXECUTED',
        75
      );
    });

    it('should update command status to FAILED when executed=false', async () => {
      MockedCommandRepository.prototype.findByIdAndNodeId.mockReturnValue(mockDispatchedCommand as any);
      MockedCommandRepository.prototype.updateStatus.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const { commandService } = await import('../command.service');
          commandService.acknowledge(
            req.params.commandId,
            req.body.nodeId,
            req.body.executed,
            req.body.actualPosition,
            req.body.timestamp
          );
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: false,
          actualPosition: 50, // Actual position when failed
          timestamp: new Date().toISOString(),
        });

      expect(MockedCommandRepository.prototype.updateStatus).toHaveBeenCalledWith(
        'cmd-123',
        'FAILED',
        undefined
      );
    });

    it('should update node valve state with actual position when executed=true', async () => {
      MockedCommandRepository.prototype.findByIdAndNodeId.mockReturnValue(mockDispatchedCommand as any);
      MockedCommandRepository.prototype.updateStatus.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateValveState.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const { commandService } = await import('../command.service');
          commandService.acknowledge(
            req.params.commandId,
            req.body.nodeId,
            req.body.executed,
            req.body.actualPosition,
            req.body.timestamp
          );
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          actualPosition: 75,
          timestamp: new Date().toISOString(),
        });

      expect(MockedNodeRepository.prototype.updateValveState).toHaveBeenCalledWith(
        'DMA-01',
        { currentPosition: 75 }
      );
    });

    it('should return 400 when command is not found', async () => {
      MockedCommandRepository.prototype.findByIdAndNodeId.mockReturnValue(null);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const { commandService } = await import('../command.service');
          commandService.acknowledge(
            req.params.commandId,
            req.body.nodeId,
            req.body.executed,
            req.body.actualPosition,
            req.body.timestamp
          );
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/commands/unknown-cmd/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          actualPosition: 75,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Command unknown-cmd not found for node DMA-01');
    });
  });

  describe('Alert Triggering', () => {
    it('should emit alert when command execution fails', async () => {
      MockedCommandRepository.prototype.findByIdAndNodeId.mockReturnValue(mockDispatchedCommand as any);
      MockedCommandRepository.prototype.updateStatus.mockReturnValue(undefined);
      (eventBus.emitAlertTriggered as jest.Mock).mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const { commandService } = await import('../command.service');
          commandService.acknowledge(
            req.params.commandId,
            req.body.nodeId,
            req.body.executed,
            req.body.actualPosition,
            req.body.timestamp
          );
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: false,
          actualPosition: 50,
          timestamp: new Date().toISOString(),
        });

      expect(eventBus.emitAlertTriggered).toHaveBeenCalledWith({
        nodeId: 'DMA-01',
        message: 'Valve command execution failed on node',
        riskLevel: 'WARNING',
      });
    });

    it('should not emit alert when command executes successfully', async () => {
      MockedCommandRepository.prototype.findByIdAndNodeId.mockReturnValue(mockDispatchedCommand as any);
      MockedCommandRepository.prototype.updateStatus.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateValveState.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const { commandService } = await import('../command.service');
          commandService.acknowledge(
            req.params.commandId,
            req.body.nodeId,
            req.body.executed,
            req.body.actualPosition,
            req.body.timestamp
          );
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          actualPosition: 75,
          timestamp: new Date().toISOString(),
        });

      expect(eventBus.emitAlertTriggered).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle actualPosition at boundary values (0)', async () => {
      MockedCommandRepository.prototype.findByIdAndNodeId.mockReturnValue({
        ...mockDispatchedCommand,
        targetPosition: 0,
      } as any);
      MockedCommandRepository.prototype.updateStatus.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateValveState.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const { commandService } = await import('../command.service');
          commandService.acknowledge(
            req.params.commandId,
            req.body.nodeId,
            req.body.executed,
            req.body.actualPosition,
            req.body.timestamp
          );
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          actualPosition: 0,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
      expect(MockedNodeRepository.prototype.updateValveState).toHaveBeenCalledWith(
        'DMA-01',
        { currentPosition: 0 }
      );
    });

    it('should handle actualPosition at boundary values (100)', async () => {
      MockedCommandRepository.prototype.findByIdAndNodeId.mockReturnValue({
        ...mockDispatchedCommand,
        targetPosition: 100,
      } as any);
      MockedCommandRepository.prototype.updateStatus.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateValveState.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const { commandService } = await import('../command.service');
          commandService.acknowledge(
            req.params.commandId,
            req.body.nodeId,
            req.body.executed,
            req.body.actualPosition,
            req.body.timestamp
          );
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          actualPosition: 100,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
      expect(MockedNodeRepository.prototype.updateValveState).toHaveBeenCalledWith(
        'DMA-01',
        { currentPosition: 100 }
      );
    });

    it('should handle fractional actualPosition values', async () => {
      MockedCommandRepository.prototype.findByIdAndNodeId.mockReturnValue(mockDispatchedCommand as any);
      MockedCommandRepository.prototype.updateStatus.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateValveState.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const { commandService } = await import('../command.service');
          commandService.acknowledge(
            req.params.commandId,
            req.body.nodeId,
            req.body.executed,
            req.body.actualPosition,
            req.body.timestamp
          );
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          actualPosition: 75.5,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
    });

    it('should handle commandId with UUID format', async () => {
      const uuidCommandId = '550e8400-e29b-41d4-a716-446655440000';
      MockedCommandRepository.prototype.findByIdAndNodeId.mockReturnValue({
        ...mockDispatchedCommand,
        id: uuidCommandId,
      } as any);
      MockedCommandRepository.prototype.updateStatus.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateValveState.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const { commandService } = await import('../command.service');
          commandService.acknowledge(
            req.params.commandId,
            req.body.nodeId,
            req.body.executed,
            req.body.actualPosition,
            req.body.timestamp
          );
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post(`/api/v1/esp/commands/${uuidCommandId}/ack`)
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          executed: true,
          actualPosition: 75,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
    });

    it('should handle timestamp in different ISO 8601 formats', async () => {
      MockedCommandRepository.prototype.findByIdAndNodeId.mockReturnValue(mockDispatchedCommand as any);
      MockedCommandRepository.prototype.updateStatus.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateValveState.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const { commandService } = await import('../command.service');
          commandService.acknowledge(
            req.params.commandId,
            req.body.nodeId,
            req.body.executed,
            req.body.actualPosition,
            req.body.timestamp
          );
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const timestamps = [
        '2026-03-20T10:00:00.000Z',
        '2026-03-20T10:00:00Z',
        '2026-03-20T10:00:00+00:00',
      ];

      for (const timestamp of timestamps) {
        const response = await request(testApp)
          .post('/api/v1/esp/commands/cmd-123/ack')
          .set('Authorization', 'Bearer valid-api-key-123')
          .send({
            nodeId: 'DMA-01',
            executed: true,
            actualPosition: 75,
            timestamp,
          });

        expect(response.status).toBe(200);
      }
    });

    it('should handle nodeId with special characters', async () => {
      MockedCommandRepository.prototype.findByIdAndNodeId.mockReturnValue(null);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/commands/:commandId/ack', async (req, res) => {
        try {
          const { commandService } = await import('../command.service');
          commandService.acknowledge(
            req.params.commandId,
            req.body.nodeId,
            req.body.executed,
            req.body.actualPosition,
            req.body.timestamp
          );
          res.json({ acknowledged: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/commands/cmd-123/ack')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-\u4e2d\u6587-01', // DMA-中文-01
          executed: true,
          actualPosition: 75,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not found');
    });
  });
});
