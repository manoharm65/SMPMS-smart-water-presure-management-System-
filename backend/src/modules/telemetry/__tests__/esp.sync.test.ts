import request from 'supertest';
import express, { Express } from 'express';
import { TelemetryService } from '../telemetry.service';
import { NodeRepository } from '../../../repositories/node.repository';
import { TelemetryRepository } from '../../../repositories/telemetry.repository';

// Mock dependencies
jest.mock('../../../repositories/node.repository');
jest.mock('../../../repositories/telemetry.repository');

const MockedNodeRepository = NodeRepository as jest.MockedClass<typeof NodeRepository>;
const MockedTelemetryRepository = TelemetryRepository as jest.MockedClass<typeof TelemetryRepository>;

describe('ESP Telemetry Sync API (POST /api/v1/esp/telemetry/sync)', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    telemetryService = new TelemetryService();

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
      testApp.post('/api/v1/esp/telemetry/sync', (_req, res) => {
        res.status(401).json({ error: 'Missing Bearer token' });
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .send({
          nodeId: 'DMA-01',
          readings: [
            { pressure: 10.5, valvePosition: 50, timestamp: new Date().toISOString() },
          ],
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing Bearer token');
    });

    it('should return 401 when invalid API key is provided', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', (req, res) => {
        const authHeader = req.headers.authorization;
        const apiKey = authHeader?.slice(7);
        if (apiKey === 'invalid-api-key') {
          res.status(401).json({ error: 'Invalid API key' });
        } else {
          res.status(401).json({ error: 'Node not found' });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer invalid-api-key')
        .send({
          nodeId: 'DMA-01',
          readings: [
            { pressure: 10.5, valvePosition: 50, timestamp: new Date().toISOString() },
          ],
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid API key');
    });
  });

  describe('Input Validation', () => {
    it('should return 400 when nodeId is missing', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {
          const dto = req.body;
          if (!dto.nodeId) {
            res.status(400).json({ error: 'nodeId is required' });
            return;
          }
          res.json({ synced: 0 });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          readings: [
            { pressure: 10.5, valvePosition: 50, timestamp: new Date().toISOString() },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('nodeId is required');
    });

    it('should return 400 when readings is missing', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {
          const dto = req.body;
          if (!dto.readings) {
            res.status(400).json({ error: 'readings is required' });
            return;
          }
          res.json({ synced: 0 });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('readings is required');
    });

    it('should return 400 when readings is not an array', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {
          const dto = req.body;
          if (!Array.isArray(dto.readings)) {
            res.status(400).json({ error: 'readings must be an array' });
            return;
          }
          res.json({ synced: 0 });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings: 'not-an-array',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('readings must be an array');
    });

    it('should return 400 when readings is empty array', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {

          const dto = req.body;
          if (dto.readings.length === 0) {
            res.status(400).json({ error: 'readings array cannot be empty' });
            return;
          }
          const synced = await telemetryService.syncBuffered(dto);
          res.json({ synced });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('readings array cannot be empty');
    });

    it('should return 400 when reading is missing required fields', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {
          const dto = req.body;
          // Validate each reading
          for (let i = 0; i < dto.readings.length; i++) {
            const reading = dto.readings[i];
            if (reading.pressure === undefined) {
              res.status(400).json({ error: `readings[${i}].pressure is required` });
              return;
            }
            if (reading.valvePosition === undefined) {
              res.status(400).json({ error: `readings[${i}].valvePosition is required` });
              return;
            }
            if (!reading.timestamp) {
              res.status(400).json({ error: `readings[${i}].timestamp is required` });
              return;
            }
          }
          res.json({ synced: dto.readings.length });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings: [
            { pressure: 10.5 }, // missing valvePosition and timestamp
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('readings[0].valvePosition is required');
    });

    it('should return 400 when reading has invalid pressure value', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {
          const dto = req.body;
          for (let i = 0; i < dto.readings.length; i++) {
            const reading = dto.readings[i];
            if (typeof reading.pressure !== 'number') {
              res.status(400).json({ error: `readings[${i}].pressure must be a number` });
              return;
            }
          }
          res.json({ synced: dto.readings.length });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings: [
            { pressure: 'invalid', valvePosition: 50, timestamp: new Date().toISOString() },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('readings[0].pressure must be a number');
    });
  });

  describe('Sync Operations', () => {
    it('should return 400 when node is not found', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(null);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {

          const result = await telemetryService.syncBuffered(req.body);
          res.json({ synced: result });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'UNKNOWN-NODE',
          readings: [
            { pressure: 10.5, valvePosition: 50, timestamp: new Date().toISOString() },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Node UNKNOWN-NODE not found');
    });

    it('should sync single reading successfully', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.createBulk.mockReturnValue(1);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {

          const result = await telemetryService.syncBuffered(req.body);
          res.json({ synced: result });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const timestamp = new Date().toISOString();
      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings: [
            { pressure: 10.5, valvePosition: 50, timestamp },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ synced: 1 });
    });

    it('should sync multiple readings successfully', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.createBulk.mockReturnValue(3);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {

          const result = await telemetryService.syncBuffered(req.body);
          res.json({ synced: result });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const baseTime = new Date();
      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings: [
            { pressure: 10.5, valvePosition: 50, timestamp: new Date(baseTime.getTime()).toISOString() },
            { pressure: 10.6, valvePosition: 52, timestamp: new Date(baseTime.getTime() + 10000).toISOString() },
            { pressure: 10.7, valvePosition: 54, timestamp: new Date(baseTime.getTime() + 20000).toISOString() },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ synced: 3 });
    });

    it('should sync large buffer (100+ readings)', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.createBulk.mockReturnValue(150);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {

          const result = await telemetryService.syncBuffered(req.body);
          res.json({ synced: result });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const readings = Array.from({ length: 150 }, (_, i) => ({
        pressure: 10.0 + (i * 0.01),
        valvePosition: 50 + i,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
      }));

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ synced: 150 });
    });

    it('should update node last_seen to most recent reading timestamp', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.createBulk.mockReturnValue(2);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {

          await telemetryService.syncBuffered(req.body);
          res.json({ synced: 2 });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const baseTime = new Date();
      await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings: [
            { pressure: 10.5, valvePosition: 50, timestamp: new Date(baseTime.getTime()).toISOString() },
            { pressure: 10.6, valvePosition: 52, timestamp: new Date(baseTime.getTime() + 10000).toISOString() },
          ],
        });

      // Should update last_seen to the last reading's timestamp
      expect(MockedNodeRepository.prototype.updateStatusAndLastSeen).toHaveBeenCalledWith(
        'DMA-01',
        'online',
        expect.any(String)
      );
    });

    it('should call createBulk with correct data structure', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.createBulk.mockReturnValue(2);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {

          await telemetryService.syncBuffered(req.body);
          res.json({ synced: 2 });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const baseTime = new Date();
      await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings: [
            { pressure: 10.5, valvePosition: 50, timestamp: new Date(baseTime.getTime()).toISOString() },
            { pressure: 10.6, valvePosition: 52, timestamp: new Date(baseTime.getTime() + 10000).toISOString() },
          ],
        });

      expect(MockedTelemetryRepository.prototype.createBulk).toHaveBeenCalledWith([
        { nodeId: 'DMA-01', pressure: 10.5, valvePosition: 50, timestamp: expect.any(String) },
        { nodeId: 'DMA-01', pressure: 10.6, valvePosition: 52, timestamp: expect.any(String) },
      ]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle readings with 0 pressure', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.createBulk.mockReturnValue(1);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {

          const result = await telemetryService.syncBuffered(req.body);
          res.json({ synced: result });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings: [
            { pressure: 0, valvePosition: 50, timestamp: new Date().toISOString() },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.synced).toBe(1);
    });

    it('should handle readings with negative pressure', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.createBulk.mockReturnValue(1);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {

          const result = await telemetryService.syncBuffered(req.body);
          res.json({ synced: result });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings: [
            { pressure: -0.5, valvePosition: 50, timestamp: new Date().toISOString() },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.synced).toBe(1);
    });

    it('should handle valvePosition at boundary values (0 and 100)', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.createBulk.mockReturnValue(2);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {

          const result = await telemetryService.syncBuffered(req.body);
          res.json({ synced: result });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings: [
            { pressure: 10.5, valvePosition: 0, timestamp: new Date().toISOString() },
            { pressure: 10.6, valvePosition: 100, timestamp: new Date().toISOString() },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.synced).toBe(2);
    });

    it('should handle readings with fractional pressure values', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.createBulk.mockReturnValue(1);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {

          const result = await telemetryService.syncBuffered(req.body);
          res.json({ synced: result });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings: [
            { pressure: 3.14159, valvePosition: 50, timestamp: new Date().toISOString() },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.synced).toBe(1);
    });

    it('should handle ISO 8601 timestamp format', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.createBulk.mockReturnValue(1);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {

          const result = await telemetryService.syncBuffered(req.body);
          res.json({ synced: result });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings: [
            { pressure: 10.5, valvePosition: 50, timestamp: '2026-03-20T10:00:00.000Z' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.synced).toBe(1);
    });

    it('should handle Unix epoch timestamp', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(mockNode as any);
      MockedTelemetryRepository.prototype.createBulk.mockReturnValue(1);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/esp/telemetry/sync', async (req, res) => {
        try {

          const result = await telemetryService.syncBuffered(req.body);
          res.json({ synced: result });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/esp/telemetry/sync')
        .set('Authorization', 'Bearer valid-api-key-123')
        .send({
          nodeId: 'DMA-01',
          readings: [
            { pressure: 10.5, valvePosition: 50, timestamp: '1742541600000' }, // Unix ms as string
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.synced).toBe(1);
    });
  });
});
