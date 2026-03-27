import { v4 as uuidv4 } from 'uuid';
import { nodeRepository } from '../../repositories/node.repository.js';
import { config } from '../../core/config.js';
import { Node } from '../../types/index.js';

export class NodeService {
  findAll(): Node[] {
    return nodeRepository.findAll();
  }

  findByNodeId(nodeId: string): Node | null {
    return nodeRepository.findByNodeId(nodeId);
  }

  create(nodeId: string, name?: string, location?: string): Node {
    const existing = nodeRepository.findByNodeId(nodeId);
    if (existing) {
      throw new Error(`Node with ID ${nodeId} already exists`);
    }
    return nodeRepository.create(nodeId, name, location);
  }

  update(id: string, updates: { name?: string; location?: string; isActive?: boolean }): Node | null {
    return nodeRepository.update(id, updates);
  }

  exists(nodeId: string): boolean {
    return nodeRepository.exists(nodeId);
  }

  register(nodeId: string, _firmwareVersion: string, _ipAddress: string): {
    node: Node;
    apiKey: string;
    telemetryIntervalMs: number;
    pressureThresholds: {
      criticalHigh: number;
      warningHigh: number;
      normalLow: number;
      criticalLow: number;
    };
  } {
    let node = nodeRepository.findByNodeId(nodeId);
    let apiKey: string;

    if (node) {
      // Node already registered — reuse existing API key or generate new one
      apiKey = node.apiKey ?? uuidv4().replace(/-/g, '');
      if (!node.apiKey) {
        nodeRepository.updateApiKey(nodeId, apiKey);
      }
      nodeRepository.updateStatusAndLastSeen(nodeId, 'online');
    } else {
      // New node — create with generated API key
      apiKey = uuidv4().replace(/-/g, '');
      node = nodeRepository.create(nodeId, undefined, undefined);
      nodeRepository.updateApiKey(nodeId, apiKey);
      nodeRepository.updateStatusAndLastSeen(nodeId, 'online');
    }

    return {
      node: { ...node, apiKey },
      apiKey,
      telemetryIntervalMs: config.telemetryIntervalMs,
      pressureThresholds: {
        criticalHigh: config.pressureCriticalHigh,
        warningHigh: config.pressureWarningHigh,
        normalLow: config.pressureNormalLow,
        criticalLow: config.pressureCriticalLow,
      },
    };
  }
}

export const nodeService = new NodeService();
