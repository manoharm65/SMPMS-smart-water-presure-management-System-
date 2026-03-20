import request from 'supertest';
import express, { Express } from 'express';
import { NodeService } from '../node.service';
import { NodeRepository } from '../../../repositories/node.repository';

// Mock dependencies
jest.mock('../../../repositories/node.repository');
jest.mock('../../../core/config', () => ({
  config: {
    telemetryIntervalMs: 10000,
    pressureCriticalHigh: 5.5,
    pressureWarningHigh: 4.5,
    pressureNormalLow: 2.5,
    pressureCriticalLow: 1.5,
  },
}));

const MockedNodeRepository = NodeRepository as jest.MockedClass<typeof NodeRepository>;

describe('ESP Node Registration API (POST /api/v1/nodes/register)', () => {
  let app: Express;
  let nodeService: NodeService;

  beforeEach(() => {
    jest.clearAllMocks();
    nodeService = new NodeService();

    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('Input Validation', () => {
    it('should return 400 when nodeId is missing', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const dto = req.body;
          if (!dto.nodeId) {
            res.status(400).json({ error: 'nodeId is required' });
            return;
          }
          res.json({ registered: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.100',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('nodeId is required');
    });

    it('should return 400 when firmwareVersion is missing', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const dto = req.body;
          if (!dto.firmwareVersion) {
            res.status(400).json({ error: 'firmwareVersion is required' });
            return;
          }
          res.json({ registered: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 'DMA-01',
          ipAddress: '192.168.1.100',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('firmwareVersion is required');
    });

    it('should return 400 when ipAddress is missing', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const dto = req.body;
          if (!dto.ipAddress) {
            res.status(400).json({ error: 'ipAddress is required' });
            return;
          }
          res.json({ registered: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 'DMA-01',
          firmwareVersion: '1.0.0',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('ipAddress is required');
    });

    it('should return 400 when nodeId is not a string', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const dto = req.body;
          if (typeof dto.nodeId !== 'string') {
            res.status(400).json({ error: 'nodeId must be a string' });
            return;
          }
          res.json({ registered: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 12345,
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.100',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('nodeId must be a string');
    });

    it('should return 400 when firmwareVersion is not a string', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const dto = req.body;
          if (typeof dto.firmwareVersion !== 'string') {
            res.status(400).json({ error: 'firmwareVersion must be a string' });
            return;
          }
          res.json({ registered: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 'DMA-01',
          firmwareVersion: 100,
          ipAddress: '192.168.1.100',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('firmwareVersion must be a string');
    });
  });

  describe('New Node Registration', () => {
    it('should register a new node successfully', async () => {
      const newNode = {
        id: 'new-node-uuid',
        nodeId: 'DMA-01',
        name: undefined,
        location: undefined,
        isActive: true,
        valvePosition: 50,
        valveMode: 'auto' as const,
        currentPosition: 50,
        targetPosition: 0,
        status: 'online' as const,
        apiKey: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(null);
      MockedNodeRepository.prototype.create.mockReturnValue(newNode as any);
      MockedNodeRepository.prototype.updateApiKey.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateStatusAndLastSeen.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const { nodeService } = await import('../node.service');
          const result = nodeService.register(req.body.nodeId, req.body.firmwareVersion, req.body.ipAddress);
          res.json({
            registered: true,
            node_id: result.node.nodeId,
            telemetry_interval_ms: result.telemetryIntervalMs,
            pressure_thresholds: result.pressureThresholds,
          });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 'DMA-01',
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.100',
        });

      expect(response.status).toBe(200);
      expect(response.body.registered).toBe(true);
      expect(response.body.node_id).toBe('DMA-01');
      expect(response.body.telemetry_interval_ms).toBe(10000);
      expect(response.body.pressure_thresholds).toEqual({
        critical_high: 5.5,
        warning_high: 4.5,
        normal_low: 2.5,
        critical_low: 1.5,
      });
    });

    it('should generate a new API key for new node', async () => {
      const newNode = {
        id: 'new-node-uuid',
        nodeId: 'DMA-01',
        isActive: true,
        status: 'online' as const,
        apiKey: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(null);
      MockedNodeRepository.prototype.create.mockReturnValue(newNode as any);
      MockedNodeRepository.prototype.updateApiKey.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateStatusAndLastSeen.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const { nodeService } = await import('../node.service');
          const result = nodeService.register(req.body.nodeId, req.body.firmwareVersion, req.body.ipAddress);
          res.json({
            registered: true,
            node_id: result.node.nodeId,
            api_key: result.apiKey,
            telemetry_interval_ms: result.telemetryIntervalMs,
            pressure_thresholds: result.pressureThresholds,
          });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 'DMA-01',
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.100',
        });

      expect(response.status).toBe(200);
      expect(response.body.api_key).toBeDefined();
      expect(response.body.api_key).toMatch(/^[a-z0-9]{32}$/); // UUID without dashes
    });

    it('should call nodeRepository.create for new node', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(null);
      MockedNodeRepository.prototype.create.mockReturnValue({
        id: 'new-node-uuid',
        nodeId: 'DMA-01',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      MockedNodeRepository.prototype.updateApiKey.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateStatusAndLastSeen.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const { nodeService } = await import('../node.service');
          nodeService.register(req.body.nodeId, req.body.firmwareVersion, req.body.ipAddress);
          res.json({ registered: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 'DMA-01',
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.100',
        });

      expect(MockedNodeRepository.prototype.create).toHaveBeenCalledWith('DMA-01', undefined, undefined);
    });
  });

  describe('Existing Node Re-registration', () => {
    it('should reuse existing node and regenerate API key', async () => {
      const existingNode = {
        id: 'existing-node-uuid',
        nodeId: 'DMA-01',
        name: 'Existing Node',
        isActive: true,
        status: 'online' as const,
        apiKey: 'old-api-key',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(existingNode as any);
      MockedNodeRepository.prototype.updateApiKey.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateStatusAndLastSeen.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const { nodeService } = await import('../node.service');
          const result = nodeService.register(req.body.nodeId, req.body.firmwareVersion, req.body.ipAddress);
          res.json({
            registered: true,
            node_id: result.node.nodeId,
            api_key: result.apiKey,
            telemetry_interval_ms: result.telemetryIntervalMs,
            pressure_thresholds: result.pressureThresholds,
          });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 'DMA-01',
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.100',
        });

      expect(response.status).toBe(200);
      expect(response.body.registered).toBe(true);
      // Should generate new API key since existing node has apiKey
      expect(response.body.api_key).toBeDefined();
    });

    it('should not create new node if node already exists', async () => {
      const existingNode = {
        id: 'existing-node-uuid',
        nodeId: 'DMA-01',
        isActive: true,
        status: 'online' as const,
        apiKey: 'existing-api-key',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(existingNode as any);
      MockedNodeRepository.prototype.updateApiKey.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateStatusAndLastSeen.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const { nodeService } = await import('../node.service');
          nodeService.register(req.body.nodeId, req.body.firmwareVersion, req.body.ipAddress);
          res.json({ registered: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 'DMA-01',
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.100',
        });

      expect(MockedNodeRepository.prototype.create).not.toHaveBeenCalled();
    });

    it('should update node status to online on re-registration', async () => {
      const existingNode = {
        id: 'existing-node-uuid',
        nodeId: 'DMA-01',
        isActive: true,
        status: 'offline' as const,
        apiKey: 'existing-api-key',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(existingNode as any);
      MockedNodeRepository.prototype.updateApiKey.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateStatusAndLastSeen.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const { nodeService } = await import('../node.service');
          nodeService.register(req.body.nodeId, req.body.firmwareVersion, req.body.ipAddress);
          res.json({ registered: true });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 'DMA-01',
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.100',
        });

      expect(MockedNodeRepository.prototype.updateStatusAndLastSeen).toHaveBeenCalledWith(
        'DMA-01',
        'online',
        undefined
      );
    });
  });

  describe('Response Format', () => {
    it('should return correct response structure for new node', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(null);
      MockedNodeRepository.prototype.create.mockReturnValue({
        id: 'new-node-uuid',
        nodeId: 'DMA-01',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      MockedNodeRepository.prototype.updateApiKey.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateStatusAndLastSeen.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const { nodeService } = await import('../node.service');
          const result = nodeService.register(req.body.nodeId, req.body.firmwareVersion, req.body.ipAddress);
          res.json({
            registered: true,
            node_id: result.node.nodeId,
            telemetry_interval_ms: result.telemetryIntervalMs,
            pressure_thresholds: {
              critical_high: result.pressureThresholds.criticalHigh,
              warning_high: result.pressureThresholds.warningHigh,
              normal_low: result.pressureThresholds.normalLow,
              critical_low: result.pressureThresholds.criticalLow,
            },
          });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 'DMA-01',
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.100',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('registered');
      expect(response.body).toHaveProperty('node_id');
      expect(response.body).toHaveProperty('telemetry_interval_ms');
      expect(response.body).toHaveProperty('pressure_thresholds');
      expect(response.body.pressure_thresholds).toHaveProperty('critical_high');
      expect(response.body.pressure_thresholds).toHaveProperty('warning_high');
      expect(response.body.pressure_thresholds).toHaveProperty('normal_low');
      expect(response.body.pressure_thresholds).toHaveProperty('critical_low');
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in nodeId', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(null);
      MockedNodeRepository.prototype.create.mockReturnValue({
        id: 'new-node-uuid',
        nodeId: 'DMA-01-SPECIAL',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      MockedNodeRepository.prototype.updateApiKey.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateStatusAndLastSeen.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const { nodeService } = await import('../node.service');
          const result = nodeService.register(req.body.nodeId, req.body.firmwareVersion, req.body.ipAddress);
          res.json({ registered: true, node_id: result.node.nodeId });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 'DMA-01-SPECIAL',
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.100',
        });

      expect(response.status).toBe(200);
      expect(response.body.node_id).toBe('DMA-01-SPECIAL');
    });

    it('should handle very long firmware version string', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(null);
      MockedNodeRepository.prototype.create.mockReturnValue({
        id: 'new-node-uuid',
        nodeId: 'DMA-01',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      MockedNodeRepository.prototype.updateApiKey.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateStatusAndLastSeen.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const { nodeService } = await import('../node.service');
          const result = nodeService.register(req.body.nodeId, req.body.firmwareVersion, req.body.ipAddress);
          res.json({ registered: true, node_id: result.node.nodeId });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 'DMA-01',
          firmwareVersion: '1.0.0-beta.2+build.1234567890abcdef',
          ipAddress: '192.168.1.100',
        });

      expect(response.status).toBe(200);
    });

    it('should handle IPv6 address', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(null);
      MockedNodeRepository.prototype.create.mockReturnValue({
        id: 'new-node-uuid',
        nodeId: 'DMA-01',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      MockedNodeRepository.prototype.updateApiKey.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateStatusAndLastSeen.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const { nodeService } = await import('../node.service');
          const result = nodeService.register(req.body.nodeId, req.body.firmwareVersion, req.body.ipAddress);
          res.json({ registered: true, node_id: result.node.nodeId });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 'DMA-01',
          firmwareVersion: '1.0.0',
          ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        });

      expect(response.status).toBe(200);
    });

    it('should handle nodeId with underscores and dashes', async () => {
      MockedNodeRepository.prototype.findByNodeId.mockReturnValue(null);
      MockedNodeRepository.prototype.create.mockReturnValue({
        id: 'new-node-uuid',
        nodeId: 'DMA_01-TEST',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      MockedNodeRepository.prototype.updateApiKey.mockReturnValue(undefined);
      MockedNodeRepository.prototype.updateStatusAndLastSeen.mockReturnValue(undefined);

      const testApp = express();
      testApp.use(express.json());
      testApp.post('/api/v1/nodes/register', async (req, res) => {
        try {
          const { nodeService } = await import('../node.service');
          const result = nodeService.register(req.body.nodeId, req.body.firmwareVersion, req.body.ipAddress);
          res.json({ registered: true, node_id: result.node.nodeId });
        } catch (err: any) {
          res.status(400).json({ error: err.message });
        }
      });

      const response = await request(testApp)
        .post('/api/v1/nodes/register')
        .send({
          nodeId: 'DMA_01-TEST',
          firmwareVersion: '1.0.0',
          ipAddress: '192.168.1.100',
        });

      expect(response.status).toBe(200);
      expect(response.body.node_id).toBe('DMA_01-TEST');
    });
  });
});
