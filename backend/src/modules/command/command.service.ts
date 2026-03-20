import { eventBus, ActionPayload } from '../../core/event-bus.js';
import { commandRepository } from '../../repositories/command.repository.js';
import { telegramService } from '../../integrations/telegram.service.js';
import { Command } from '../../types/index.js';

export class CommandService {
  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventBus.onActionDispatched(async (payload: ActionPayload) => {
      await this.handleActionDispatched(payload);
    });
  }

  private async handleActionDispatched(payload: ActionPayload): Promise<void> {
    console.log(`[Command] Dispatching action ${payload.command} to node ${payload.nodeId}`);

    // Store command in database
    const command = commandRepository.create({
      nodeId: payload.nodeId,
      command: payload.command,
    });

    // Update status to sent
    commandRepository.updateStatus(command.id, 'sent');

    console.log(`[Command] Stored and marked as sent: ${command.id}`);

    // Send Telegram notification
    await telegramService.sendCommandNotification({
      nodeId: payload.nodeId,
      command: payload.command,
    });
  }

  create(nodeId: string, command: string): Command {
    const cmd = commandRepository.create({ nodeId, command });
    commandRepository.updateStatus(cmd.id, 'sent');
    return commandRepository.findById(cmd.id)!;
  }

  findByNodeId(nodeId: string, limit = 50): Command[] {
    return commandRepository.findByNodeId(nodeId, limit);
  }

  findAll(limit = 100, offset = 0): Command[] {
    return commandRepository.findAll(limit, offset);
  }

  updateStatus(id: string, status: string): void {
    commandRepository.updateStatus(id, status);
  }
}

export const commandService = new CommandService();
