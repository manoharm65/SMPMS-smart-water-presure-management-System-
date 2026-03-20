import { nodeRepository } from '../../repositories/node.repository.js';
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
}

export const nodeService = new NodeService();
