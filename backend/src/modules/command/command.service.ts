import { eventBus, ActionPayload, CommandAckPayload, CommandTimeoutPayload, ValveModePayload } from '../../core/event-bus.js';
import { commandRepository } from '../../repositories/command.repository.js';
import { nodeRepository } from '../../repositories/node.repository.js';
import { telegramService } from '../../integrations/telegram.service.js';
import { config } from '../../core/config.js';
import { Command, CommandPriority } from '../../types/index.js';
import { COMMAND_PRIORITY, COMMAND_STATUS } from '../../core/constants.js';

export class CommandService {
  private timeoutCheckerInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.setupEventListeners();
    this.startTimeoutChecker();
  }

  private setupEventListeners(): void {
    // Handle ACTION_DISPATCHED from decision engine
    eventBus.onActionDispatched(async (payload: ActionPayload) => {
      await this.handleActionDispatched(payload);
    });

    // Handle ACK from ESP via telemetry
    eventBus.onCommandAckReceived(async (payload: CommandAckPayload) => {
      await this.handleCommandAck(payload);
    });

    // Handle valve mode changes
    eventBus.onValveModeChanged(async (payload: ValveModePayload) => {
      await this.handleValveModeChanged(payload);
    });
  }

  // Start the timeout checker interval
  private startTimeoutChecker(): void {
    const checkInterval = config.commandTimeoutCheckMs; // 30 seconds default
    this.timeoutCheckerInterval = setInterval(() => {
      this.checkTimeouts();
    }, checkInterval);
    console.log(`[CommandService] Timeout checker started (interval: ${checkInterval}ms)`);
  }

  // Check for timed out commands
  private async checkTimeouts(): Promise<void> {
    const thresholdMs = config.telemetryIntervalMs * config.commandTimeoutCycles; // 3 cycles
    const timedOutCommands = commandRepository.findTimedOutCommands(thresholdMs);

    for (const cmd of timedOutCommands) {
      console.log(`[CommandService] Command ${cmd.id} timed out for node ${cmd.nodeId}`);

      // Update status to TIMEOUT
      commandRepository.updateStatus(cmd.id, COMMAND_STATUS.TIMEOUT);

      // Emit timeout event
      const timeoutPayload: CommandTimeoutPayload = {
        nodeId: cmd.nodeId,
        commandId: cmd.id,
        commandAgeMs: Date.now() - new Date(cmd.sentAt!).getTime(),
        thresholdMs,
      };
      eventBus.emitCommandTimeout(timeoutPayload);

      // Send Telegram alert
      await telegramService.sendTimeoutNotification({
        nodeId: cmd.nodeId,
        commandId: cmd.id,
      });

      // Emit alert triggered for logging
      eventBus.emitAlertTriggered({
        nodeId: cmd.nodeId,
        message: 'Valve command timeout — no response from edge node',
        riskLevel: 'WARNING',
      });
    }
  }

  // Handle ACTION_DISPATCHED from decision engine
  async handleActionDispatched(payload: ActionPayload): Promise<void> {
    const { nodeId, command, riskLevel, targetPosition, pressure } = payload;
    console.log(`[CommandService] Handling ACTION_DISPATCHED: ${command} for ${nodeId} (risk: ${riskLevel})`);

    // Get current valve mode
    const valveState = nodeRepository.getValveState(nodeId);
    const currentMode = valveState?.mode || 'auto';

    // Check if in override mode and not CRITICAL
    if (currentMode === 'override' && riskLevel !== 'CRITICAL') {
      console.log(`[CommandService] Node ${nodeId} in override mode, skipping dispatch`);
      return;
    }

    // Check for existing active command BEFORE determining priority
    const existingCommand = commandRepository.findActiveByNodeId(nodeId);

    // Determine priority based on risk level
    let priority: CommandPriority = 'normal';
    if (riskLevel === 'CRITICAL') {
      priority = 'critical';
    } else if (riskLevel === 'WARNING' || riskLevel === 'HIGH') {
      priority = 'warning';
    }

    if (existingCommand) {
      // Only CRITICAL can replace existing (manual goes through setManualOverride which cancels first)
      const isCritical = priority === 'critical';
      if (!isCritical) {
        console.log(`[CommandService] Existing active command for ${nodeId}, skipping (priority: ${priority})`);
        return;
      }

      // Replace existing command
      console.log(`[CommandService] Replacing existing command ${existingCommand.id} (new priority: ${priority})`);
      commandRepository.cancelByNodeId(nodeId);
    }

    // Calculate target position from command if not provided
    const finalTargetPosition = targetPosition ?? this.calculateTargetPosition(command, valveState?.currentPosition || 50);

    // Create new command
    const newCommand = commandRepository.create({
      nodeId,
      command,
      priority,
      targetPosition: finalTargetPosition,
    });

    // Update node's target_position and last_command_id
    nodeRepository.updateValveState(nodeId, {
      targetPosition: finalTargetPosition,
      lastCommandId: newCommand.id,
    });

    console.log(`[CommandService] Created PENDING command ${newCommand.id} for ${nodeId}`);

    // If CRITICAL, send Telegram notification
    if (riskLevel === 'CRITICAL') {
      await telegramService.sendCriticalCommandNotification({
        nodeId,
        command,
        targetPosition: finalTargetPosition,
        pressure: pressure || 0,
      });
    }
  }

  // Handle ACK from ESP (called by telemetry service)
  async handleCommandAck(payload: CommandAckPayload): Promise<void> {
    const { nodeId, commandId, executed, actualPosition } = payload;
    console.log(`[CommandService] ACK received for command ${commandId}: executed=${executed}, position=${actualPosition}`);

    const command = commandRepository.findById(commandId);
    if (!command) {
      console.warn(`[CommandService] ACK for unknown command ${commandId}`);
      return;
    }

    if (executed) {
      // Update command status to EXECUTED
      commandRepository.updateStatus(commandId, COMMAND_STATUS.EXECUTED, actualPosition);

      // Update node's current_position to actual position from ESP
      nodeRepository.updateValveState(nodeId, {
        currentPosition: actualPosition,
      });
    } else {
      // Update command status to FAILED
      commandRepository.updateStatus(commandId, COMMAND_STATUS.FAILED);

      // Emit alert
      eventBus.emitAlertTriggered({
        nodeId,
        message: 'Valve command execution failed on node',
        riskLevel: 'WARNING',
      });
    }
  }

  // Handle valve mode change
  async handleValveModeChanged(payload: ValveModePayload): Promise<void> {
    const { nodeId, previousMode, newMode, reason } = payload;
    console.log(`[CommandService] Valve mode changed for ${nodeId}: ${previousMode} → ${newMode} (reason: ${reason})`);

    // Update node valve mode
    nodeRepository.updateValveMode(nodeId, newMode);

    // If auto-reverted due to CRITICAL, send notification
    if (reason === 'critical_auto_revert') {
      await telegramService.sendOverrideAutoCancelledNotification({
        nodeId,
        pressure: payload.pressure || 0,
      });
    }
  }

  // Manual override from dashboard
  setManualOverride(nodeId: string, targetPosition: number, operator?: string): Command {
    console.log(`[CommandService] Manual override for ${nodeId}: set to ${targetPosition}%`);

    // Cancel any existing pending commands
    commandRepository.cancelByNodeId(nodeId);

    // Set mode to override
    nodeRepository.updateValveMode(nodeId, 'override');

    // Determine command based on current position
    const currentPos = nodeRepository.getValveState(nodeId)?.currentPosition || 50;
    const command = targetPosition < currentPos ? 'REDUCE_FLOW' : 'INCREASE_FLOW';

    // Create manual command
    const cmd = commandRepository.create({
      nodeId,
      command,
      priority: 'manual',
      targetPosition,
    });

    // Update node state
    nodeRepository.updateValveState(nodeId, {
      targetPosition,
      lastCommandId: cmd.id,
      mode: 'override',
    });

    // Send Telegram notification
    telegramService.sendManualOverrideNotification({
      nodeId,
      targetPosition,
      operator,
    });

    // Emit valve mode changed event
    eventBus.emitValveModeChanged({
      nodeId,
      previousMode: 'auto',
      newMode: 'override',
      reason: 'operator',
    });

    return cmd;
  }

  // Revert to auto mode
  revertToAuto(nodeId: string): void {
    console.log(`[CommandService] Reverting ${nodeId} to auto mode`);

    const previousMode = nodeRepository.getValveState(nodeId)?.mode || 'auto';

    // Set mode to auto (no command dispatched)
    nodeRepository.updateValveMode(nodeId, 'auto');

    // Emit valve mode changed event
    eventBus.emitValveModeChanged({
      nodeId,
      previousMode,
      newMode: 'auto',
      reason: 'operator',
    });
  }

  // Get pending command for a node (for telemetry response)
  // Marks PENDING as DISPATCHED when retrieved
  getPendingCommand(nodeId: string): Command | null {
    // Check for PENDING command
    const pending = commandRepository.findPendingByNodeId(nodeId);
    if (pending) {
      // Mark as DISPATCHED and return
      commandRepository.updateStatus(pending.id, COMMAND_STATUS.DISPATCHED);
      return commandRepository.findById(pending.id);
    }

    // Check for already DISPATCHED (awaiting ACK)
    return commandRepository.findDispatchedByNodeId(nodeId);
  }

  // Calculate target position from command string
  private calculateTargetPosition(command: string, currentPosition: number): number {
    switch (command) {
      case 'REDUCE_FLOW':
        return Math.max(0, currentPosition - 20);
      case 'INCREASE_FLOW':
        return Math.min(100, currentPosition + 20);
      case 'EMERGENCY_CLOSE':
        return 0;
      default:
        return currentPosition;
    }
  }

  // Check if CRITICAL decision should auto-revert override mode
  // Returns true if revert is needed (caller should call revertToAuto)
  checkCriticalAutoRevert(nodeId: string, riskLevel: string): boolean {
    if (riskLevel !== 'CRITICAL') return false;

    const valveState = nodeRepository.getValveState(nodeId);
    if (valveState?.mode !== 'override') return false;

    console.log(`[CommandService] CRITICAL decision on override node ${nodeId} — auto-revert needed`);
    return true;
  }

  // Legacy methods for backward compatibility
  create(nodeId: string, command: string): Command {
    const cmd = commandRepository.create({ nodeId, command });
    commandRepository.updateStatus(cmd.id, COMMAND_STATUS.DISPATCHED);
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

  acknowledge(commandId: string, nodeId: string, executed: boolean, actualPosition: number, _timestamp: string): void {
    const command = commandRepository.findByIdAndNodeId(commandId, nodeId);
    if (!command) {
      throw new Error(`Command ${commandId} not found for node ${nodeId}`);
    }
    commandRepository.updateStatus(commandId, executed ? COMMAND_STATUS.EXECUTED : COMMAND_STATUS.FAILED, executed ? actualPosition : undefined);
    console.log(`[Command] Ack: id=${commandId}, executed=${executed}, actualPosition=${actualPosition}`);
  }

  // Cleanup on shutdown
  shutdown(): void {
    if (this.timeoutCheckerInterval) {
      clearInterval(this.timeoutCheckerInterval);
      this.timeoutCheckerInterval = null;
      console.log('[CommandService] Timeout checker stopped');
    }
  }
}

export const commandService = new CommandService();
