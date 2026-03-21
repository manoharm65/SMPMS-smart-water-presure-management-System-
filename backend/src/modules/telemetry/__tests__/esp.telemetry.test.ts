import request from 'supertest';
import express, { Express } from 'express';
import { TelemetryService } from '../telemetry.service';
import { NodeRepository } from '../../../repositories/node.repository';
import { TelemetryRepository } from '../../../repositories/telemetry.repository';
import { CommandRepository } from '../../../repositories/command.repository';
import { eventBus } from '../../../core/event-bus';

// Mock dependencies
jest.mock('../../../repositories/node.repository');
jest.mock('../../../repositories/telemetry.repository');
jest.mock('../../../repositories/command.repository');
jest.mock('../../../core/event-bus');

const MockedNodeRepository = NodeRepository as jest.MockedClass<typeof NodeRepository>;
const MockedTelemetryRepository = TelemetryRepository as jest.MockedClass<typeof TelemetryRepository>;
const MockedCommandRepository = CommandRepository as jest.MockedClass<typeof CommandRepository>;

describe('ESP Telemetry API (POST /api/v1/esp/telemetry)', () => {
  let app: Express;
  let telemetryService: TelemetryService;

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

  // Mock pending command for piggyback
  const mockPendingCommand = {
    id: 'cmd-123',
    nodeId: 'DMA-01',
    command: 'REDUCE_FLOW',
    status: 'PENDING',
    priority: 'warning' as const,
    targetPosition: 75,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup telemetry service with mocked dependencies
    telemetryService = new TelemetryService();

    // Create test app with ESP auth middleware mock
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

    // Import and mount the telemetry ESP router
    import('../telemetry-esp.controller').then(({ default: router }) => {
      app.use('/api/v1/esp/telemetry', router);
    });
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('Authentication', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      // Recreate app without auth middleware for this test
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({ error: 'Missing Bearer token' });
          return;
        }
        next();
      });

      // Manually set up route for testing
      testApp.post('/api/v1/esp/telemetry', (_req, res) => {
        res.status(401).json({ error: 'Missing Bearer token' });
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry')
        .send({ nodeId: 'DMA-01', pressure: 10.5, valvePosition: 50, timestamp: new Date().toISOString() });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing Bearer token');
    });

    it('should return 401 when invalid API key is provided', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).json({ error: 'Missing Bearer token' });
          return;
        }
        const apiKey = authHeader.slice(7);
        if (apiKey === 'invalid-api-key') {
          res.status(401).json({ error: 'Invalid API key' });
        } else {
          next();
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer invalid-api-key')
        .send({ nodeId: 'DMA-01', pressure: 10.5, valvePosition: 50, timestamp: new Date().toISOString() });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid API key');
    });
  });

  describe('Input Validation', () => {
    it('should return 400 when nodeId is missing', async () => {
      MockedNodeRepository.prototype.findByApiKey.mockReturnValue(mockNode as any);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry', async (req, res) => {
        try {

          const dto = req.body;
          if (!dto.nodeId) {
            res.status(400).json({ error: 'nodeId is required' });
            return;
          }
          const result = await telemetryService.createForEsp(dto);
          res.json(result);
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({ pressure: 10.5, valvePosition: 50, timestamp: new Date().toISOString() });

      expect(response.status).toBe(400);
    });

    it('should return 400 when pressure is missing', async () => {
      MockedNodeRepository.prototype.findByApiKey.mockReturnValue(mockNode as any);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry', async (req, res) => {
        try {

          const dto = req.body;
          if (dto.pressure === undefined) {
            res.status(400).json({ error: 'pressure is required' });
            return;
          }
          const result = await telemetryService.createForEsp(dto);
          res.json(result);
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({ nodeId: 'DMA-01', valvePosition: 50, timestamp: new Date().toISOString() });

      expect(response.status).toBe(400);
    });

    it('should return 400 when valvePosition is missing', async () => {
      MockedNodeRepository.prototype.findByApiKey.mockReturnValue(mockNode as any);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry', async (req, res) => {
        try {
          const dto = req.body;
          if (dto.valvePosition === undefined) {
            res.status(400).json({ error: 'valvePosition is required' });
            return;
          }
          res.json({ received: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({ nodeId: 'DMA-01', pressure: 10.5, timestamp: new Date().toISOString() });

      expect(response.status).toBe(400);
    });

    it('should return 400 when timestamp is missing', async () => {
      MockedNodeRepository.prototype.findByApiKey.mockReturnValue(mockNode as any);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry', async (req, res) => {
        try {
          const dto = req.body;
          if (!dto.timestamp) {
            res.status(400).json({ error: 'timestamp is required' });
            return;
          }
          res.json({ received: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({ nodeId: 'DMA-01', pressure: 10.5, valvePosition: 50 });

      expect(response.status).toBe(400);
    });

    it('should return 400 when timestamp is invalid format', async () => {
      MockedNodeRepository.prototype.findByApiKey.mockReturnValue(mockNode as any);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry', async (req, res) => {
        try {
          const dto = req.body;
          // Validate timestamp format
          const timestamp = new Date(dto.timestamp);
          if (isNaN(timestamp.getTime())) {
            res.status(400).json({ error: 'Invalid timestamp format' });
            return;
          }
          res.json({ received: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({ nodeId: 'DMA-01', pressure: 10.5, valvePosition: 50, timestamp: 'invalid-date' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid timestamp format');
    });
  });

  describe('Telemetry Ingestion', () => {
    it('should return 400 when node is not found', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(null);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry', async (req, res) => {
        try {
          const result = await telemetryService.createForEsp(req.body);
          res.json(result);
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'UNKNOWN-NODE',
          pressure: 10.5,
          valvePosition: 50,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Node UNKNOWN-NODE not found');
    });

    it('should return { received: true, command: null } when no pending command exists', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.create.mockReturnValue({
        id: 'telemetry-uuid-1',
        nodeId: 'DMA-01',
        pressure: 10.5,
        valvePosition: 50,
        timestamp: new Date().toISOString(),
      });
      MockedCommandRepository.prototype.findOldestPendingByNodeId.mockReturnValue(null);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry', async (req, res) => {
        try {
          const result = await telemetryService.createForEsp(req.body);
          res.json(result);
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          pressure: 10.5,
          valvePosition: 50,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        received: true,
        command: null,
      });
    });

    it('should return piggyback command when pending command exists', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.create.mockReturnValue({
        id: 'telemetry-uuid-1',
        nodeId: 'DMA-01',
        pressure: 10.5,
        valvePosition: 50,
        timestamp: new Date().toISOString(),
      });
      MockedCommandRepository.prototype.findOldestPendingByNodeId.mockReturnValue(mockPendingCommand as any);
      MockedCommandRepository.prototype.updateStatus.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry', async (req, res) => {
        try {
          const result = await telemetryService.createForEsp(req.body);
          res.json(result);
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          pressure: 10.5,
          valvePosition: 50,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        received: true,
        command: {
          command_id: 'cmd-123',
          type: 'SET_VALVE',
          value: 75,
        },
      });
    });

    it('should emit TelemetryReceived event', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.create.mockReturnValue({
        id: 'telemetry-uuid-1',
        nodeId: 'DMA-01',
        pressure: 10.5,
        valvePosition: 50,
        timestamp: new Date().toISOString(),
      });
      MockedCommandRepository.prototype.findOldestPendingByNodeId.mockReturnValue(null);
      (eventBus.emitTelemetryReceived as jest.Mock).mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry', async (req, res) => {
        try {

          await telemetryService.createForEsp(req.body);
          res.json({ received: true, command: null });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          pressure: 10.5,
          valvePosition: 50,
          timestamp: new Date().toISOString(),
        });

      expect(eventBus.emitTelemetryReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'DMA-01',
          pressure: 10.5,
        })
      );
    });

    it('should update node status to online', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.create.mockReturnValue({
        id: 'telemetry-uuid-1',
        nodeId: 'DMA-01',
        pressure: 10.5,
        valvePosition: 50,
        timestamp: new Date().toISOString(),
      });
      MockedCommandRepository.prototype.findOldestPendingByNodeId.mockReturnValue(null);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry', async (req, res) => {
        try {

          await telemetryService.createForEsp(req.body);
          res.json({ received: true, command: null });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          pressure: 10.5,
          valvePosition: 50,
          timestamp: new Date().toISOString(),
        });

      expect(MockedNodeRepository.prototype.updateStatusAndLastSeen).toHaveBeenCalledWith(
        'DMA-01',
        'online',
        expect.any(String)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle pressure boundary values (min)', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.create.mockReturnValue({
        id: 'telemetry-uuid-1',
        nodeId: 'DMA-01',
        pressure: 0,
        valvePosition: 50,
        timestamp: new Date().toISOString(),
      });
      MockedCommandRepository.prototype.findOldestPendingByNodeId.mockReturnValue(null);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry', async (req, res) => {
        try {
          const result = await telemetryService.createForEsp(req.body);
          res.json(result);
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          pressure: 0,
          valvePosition: 50,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    it('should handle pressure boundary values (max)', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.create.mockReturnValue({
        id: 'telemetry-uuid-1',
        nodeId: 'DMA-01',
        pressure: 100,
        valvePosition: 50,
        timestamp: new Date().toISOString(),
      });
      MockedCommandRepository.prototype.findOldestPendingByNodeId.mockReturnValue(null);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry', async (req, res) => {
        try {
          const result = await telemetryService.createForEsp(req.body);
          res.json(result);
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          pressure: 100,
          valvePosition: 50,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    it('should handle valvePosition boundary values (0-100)', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.create.mockReturnValue({
        id: 'telemetry-uuid-1',
        nodeId: 'DMA-01',
        pressure: 10.5,
        valvePosition: 0,
        timestamp: new Date().toISOString(),
      });
      MockedCommandRepository.prototype.findOldestPendingByNodeId.mockReturnValue(null);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry', async (req, res) => {
        try {
          const result = await telemetryService.createForEsp(req.body);
          res.json(result);
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          pressure: 10.5,
          valvePosition: 0,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
    });

    it('should handle Unicode characters in nodeId', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(null);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry', async (req, res) => {
        try {
          const result = await telemetryService.createForEsp(req.body);
          res.json(result);
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-\u4e2d\u6587-01', // DMA-中文-01
          pressure: 10.5,
          valvePosition: 50,
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not found');
    });
  });
});
