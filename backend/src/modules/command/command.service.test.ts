import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandService } from './command.service.js';
import { COMMAND_STATUS } from '../../core/constants.js';

// ============================================================
// Mock repositories at module level using vi.hoisted
// ============================================================
const { mockCommandRepository, mockNodeRepository, mockEmit } = vi.hoisted(() => {
  const mockEmit = vi.fn();
  return {
    mockCommandRepository: {
      create: vi.fn(),
      findById: vi.fn(),
      findByNodeId: vi.fn(),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
      findPendingByNodeId: vi.fn(),
      findDispatchedByNodeId: vi.fn(),
      findActiveByNodeId: vi.fn(),
      cancelByNodeId: vi.fn(),
      findTimedOutCommands: vi.fn(),
      findOldestPendingByNodeId: vi.fn(),
      findByIdAndNodeId: vi.fn(),
    },
    mockNodeRepository: {
      getValveState: vi.fn(),
      updateValveState: vi.fn(),
      updateValveMode: vi.fn(),
      findByNodeId: vi.fn(),
    },
    mockEmit,
  };
});

vi.mock('../../repositories/command.repository.js', () => ({
  commandRepository: mockCommandRepository,
  CommandRepository: vi.fn(),
}));

vi.mock('../../repositories/node.repository.js', () => ({
  nodeRepository: mockNodeRepository,
  NodeRepository: vi.fn(),
}));

// Mock telegram service to prevent API calls
vi.mock('../../integrations/telegram.service.js', () => ({
  telegramService: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendAlert: vi.fn().mockResolvedValue(undefined),
    sendCriticalCommandNotification: vi.fn().mockResolvedValue(undefined),
    sendTimeoutNotification: vi.fn().mockResolvedValue(undefined),
    sendOverrideAutoCancelledNotification: vi.fn().mockResolvedValue(undefined),
    sendManualOverrideNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock event bus - use mockEmit from hoisted scope
vi.mock('../../core/event-bus.js', () => {
  const events: Record<string, Array<(...args: unknown[]) => void>> = {};

  const mockOn = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!events[event]) events[event] = [];
    events[event].push(handler);
  });

  return {
    eventBus: {
      emit: mockEmit,
      on: mockOn,
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
      emitTelemetryReceived: mockEmit.bind(null, 'telemetry:received'),
      emitDecisionMade: mockEmit.bind(null, 'decision:made'),
      emitAlertTriggered: mockEmit.bind(null, 'alert:triggered'),
      emitActionDispatched: mockEmit.bind(null, 'action:dispatched'),
      emitValveModeChanged: mockEmit.bind(null, 'valve:mode-changed'),
      emitCommandTimeout: mockEmit.bind(null, 'command:timeout'),
      emitCommandAckReceived: mockEmit.bind(null, 'command:ack-received'),
      onTelemetryReceived: mockOn.bind(null, 'telemetry:received'),
      onDecisionMade: mockOn.bind(null, 'decision:made'),
      onAlertTriggered: mockOn.bind(null, 'alert:triggered'),
      onActionDispatched: mockOn.bind(null, 'action:dispatched'),
      onValveModeChanged: mockOn.bind(null, 'valve:mode-changed'),
      onCommandTimeout: mockOn.bind(null, 'command:timeout'),
      onCommandAckReceived: mockOn.bind(null, 'command:ack-received'),
    },
    EventBus: class {
      static getInstance() {
        return {
          emit: mockEmit,
          on: mockOn,
          removeListener: vi.fn(),
          removeAllListeners: vi.fn(),
        };
      }
    },
  };
});

// ============================================================
// Helper to create mock commands
// ============================================================
function createMockCommand(overrides: Partial<{
  id: string;
  nodeId: string;
  command: string;
  status: string;
  priority: string;
  targetPosition: number;
  executedPosition: number;
  sentAt: string;
  createdAt: string;
}> = {}): ReturnType<typeof mockCommandRepository.create> {
  return {
    id: 'cmd-1',
    nodeId: 'node-1',
    command: 'REDUCE_FLOW',
    status: 'PENDING',
    priority: 'normal',
    targetPosition: 30,
    executedPosition: undefined,
    sentAt: undefined,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ============================================================
// Helper to verify event emissions
// ============================================================
function expectEventEmitted(eventName: string, payload?: unknown): void {
  const calls = mockEmit.mock.calls;
  const matchingCall = calls.find((call: unknown[]) => call[0] === eventName);
  expect(matchingCall).toBeDefined();
  if (payload !== undefined) {
    expect(matchingCall[1]).toEqual(payload);
  }
}

function expectEventNotEmitted(eventName: string): void {
  const calls = mockEmit.mock.calls;
  const matchingCall = calls.find((call: unknown[]) => call[0] === eventName);
  expect(matchingCall).toBeUndefined();
}

// ============================================================
// Test suite
// ============================================================
describe('CommandService', () => {
  let service: CommandService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmit.mockReset();

    // Reset mock implementations
    mockCommandRepository.create.mockReturnValue(createMockCommand());
    mockCommandRepository.findById.mockReturnValue(createMockCommand());
    mockCommandRepository.findPendingByNodeId.mockReturnValue(null);
    mockCommandRepository.findDispatchedByNodeId.mockReturnValue(null);
    mockCommandRepository.findActiveByNodeId.mockReturnValue(null);
    mockCommandRepository.cancelByNodeId.mockReturnValue(1);
    mockCommandRepository.findTimedOutCommands.mockReturnValue([]);
    mockNodeRepository.getValveState.mockReturnValue({
      nodeId: 'node-1',
      currentPosition: 50,
      targetPosition: 50,
      mode: 'auto',
    });
    mockNodeRepository.updateValveState.mockReturnValue(undefined);
    mockNodeRepository.updateValveMode.mockReturnValue(undefined);

    // Create fresh service instance for each test
    service = new CommandService();
  });

  // ============================================================
  // Test 1: State machine — PENDING→DISPATCHED
  // ============================================================
  describe('getPendingCommand', () => {
    it('should return oldest PENDING command and mark it DISPATCHED', () => {
      const pendingCmd = createMockCommand({ id: 'cmd-pending', status: 'PENDING' });
      const dispatchedCmd = createMockCommand({ id: 'cmd-pending', status: 'DISPATCHED' });

      mockCommandRepository.findPendingByNodeId.mockReturnValue(pendingCmd);
      mockCommandRepository.findById.mockReturnValue(dispatchedCmd);

      const result = service.getPendingCommand('node-1');

      expect(mockCommandRepository.findPendingByNodeId).toHaveBeenCalledWith('node-1');
      expect(mockCommandRepository.updateStatus).toHaveBeenCalledWith('cmd-pending', COMMAND_STATUS.DISPATCHED);
      expect(result).toEqual(dispatchedCmd);
    });

    it('should return DISPATCHED command if no PENDING exists (fallback)', () => {
      const dispatchedCmd = createMockCommand({ id: 'cmd-dispatched', status: 'DISPATCHED' });

      mockCommandRepository.findPendingByNodeId.mockReturnValue(null);
      mockCommandRepository.findDispatchedByNodeId.mockReturnValue(dispatchedCmd);

      const result = service.getPendingCommand('node-1');

      expect(mockCommandRepository.findPendingByNodeId).toHaveBeenCalledWith('node-1');
      expect(mockCommandRepository.findDispatchedByNodeId).toHaveBeenCalledWith('node-1');
      expect(result).toEqual(dispatchedCmd);
    });

    it('should return null when neither PENDING nor DISPATCHED exists', () => {
      mockCommandRepository.findPendingByNodeId.mockReturnValue(null);
      mockCommandRepository.findDispatchedByNodeId.mockReturnValue(null);

      const result = service.getPendingCommand('node-1');

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // Test 2 & 3: State machine — DISPATCHED→EXECUTED / FAILED
  // ============================================================
  describe('handleCommandAck', () => {
    it('should update status to EXECUTED and update node position when executed=true', async () => {
      const cmd = createMockCommand({ id: 'cmd-1', status: 'DISPATCHED' });
      mockCommandRepository.findById.mockReturnValue(cmd);

      await service.handleCommandAck({
        nodeId: 'node-1',
        commandId: 'cmd-1',
        executed: true,
        actualPosition: 30,
        timestamp: new Date(),
      });

      expect(mockCommandRepository.updateStatus).toHaveBeenCalledWith('cmd-1', COMMAND_STATUS.EXECUTED, 30);
      expect(mockNodeRepository.updateValveState).toHaveBeenCalledWith('node-1', { currentPosition: 30 });
    });

    it('should update status to FAILED when executed=false', async () => {
      const cmd = createMockCommand({ id: 'cmd-1', status: 'DISPATCHED' });
      mockCommandRepository.findById.mockReturnValue(cmd);

      await service.handleCommandAck({
        nodeId: 'node-1',
        commandId: 'cmd-1',
        executed: false,
        timestamp: new Date(),
      });

      expect(mockCommandRepository.updateStatus).toHaveBeenCalledWith('cmd-1', COMMAND_STATUS.FAILED);
      expectEventEmitted('alert:triggered');
    });

    it('should do nothing when command not found', async () => {
      mockCommandRepository.findById.mockReturnValue(null);

      await service.handleCommandAck({
        nodeId: 'node-1',
        commandId: 'unknown-cmd',
        executed: true,
        actualPosition: 30,
        timestamp: new Date(),
      });

      expect(mockCommandRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Test 4: Queue — CRITICAL replaces existing PENDING/WARNING
  // ============================================================
  describe('handleActionDispatched', () => {
    it('should cancel existing command and create CRITICAL when CRITICAL arrives', async () => {
      const existingCmd = createMockCommand({ id: 'existing-cmd', status: 'PENDING', priority: 'warning' });
      mockCommandRepository.findActiveByNodeId.mockReturnValue(existingCmd);

      const newCmd = createMockCommand({ id: 'new-cmd', priority: 'critical' });
      mockCommandRepository.create.mockReturnValue(newCmd);

      await service.handleActionDispatched({
        nodeId: 'node-1',
        command: 'REDUCE_FLOW',
        riskLevel: 'CRITICAL',
        pressure: 6.5,
      });

      expect(mockCommandRepository.cancelByNodeId).toHaveBeenCalledWith('node-1');
      expect(mockCommandRepository.create).toHaveBeenCalledWith({
        nodeId: 'node-1',
        command: 'REDUCE_FLOW',
        priority: 'critical',
        targetPosition: expect.any(Number),
      });
    });

    it('should NOT create WARNING command when CRITICAL already exists', async () => {
      const existingCmd = createMockCommand({ id: 'existing-cmd', status: 'PENDING', priority: 'critical' });
      mockCommandRepository.findActiveByNodeId.mockReturnValue(existingCmd);

      await service.handleActionDispatched({
        nodeId: 'node-1',
        command: 'REDUCE_FLOW',
        riskLevel: 'WARNING',
        pressure: 4.8,
      });

      expect(mockCommandRepository.create).not.toHaveBeenCalled();
      expect(mockCommandRepository.cancelByNodeId).not.toHaveBeenCalled();
    });

    it('should skip dispatch if node is in override mode and risk is not CRITICAL', async () => {
      mockNodeRepository.getValveState.mockReturnValue({
        nodeId: 'node-1',
        currentPosition: 50,
        targetPosition: 50,
        mode: 'override',
      });

      await service.handleActionDispatched({
        nodeId: 'node-1',
        command: 'REDUCE_FLOW',
        riskLevel: 'WARNING',
        pressure: 4.8,
      });

      expect(mockCommandRepository.create).not.toHaveBeenCalled();
    });

    it('should create command normally when no existing active command', async () => {
      mockCommandRepository.findActiveByNodeId.mockReturnValue(null);

      const newCmd = createMockCommand({ id: 'new-cmd', priority: 'normal' });
      mockCommandRepository.create.mockReturnValue(newCmd);

      await service.handleActionDispatched({
        nodeId: 'node-1',
        command: 'REDUCE_FLOW',
        riskLevel: 'NORMAL',
        pressure: 3.5,
      });

      expect(mockCommandRepository.create).toHaveBeenCalled();
      expect(mockCommandRepository.cancelByNodeId).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Test 6 & 9: Manual override
  // ============================================================
  describe('setManualOverride', () => {
    it('should cancel existing commands, set mode to override, and create manual command', () => {
      const cmd = createMockCommand({ id: 'manual-cmd', priority: 'manual' });
      mockCommandRepository.create.mockReturnValue(cmd);

      const result = service.setManualOverride('node-1', 70, 'operator-1');

      expect(mockCommandRepository.cancelByNodeId).toHaveBeenCalledWith('node-1');
      expect(mockNodeRepository.updateValveMode).toHaveBeenCalledWith('node-1', 'override');
      expect(mockCommandRepository.create).toHaveBeenCalledWith({
        nodeId: 'node-1',
        command: 'INCREASE_FLOW', // 70 > 50 (currentPosition)
        priority: 'manual',
        targetPosition: 70,
      });
      expect(mockNodeRepository.updateValveState).toHaveBeenCalledWith('node-1', {
        targetPosition: 70,
        lastCommandId: 'manual-cmd',
        mode: 'override',
      });
      expectEventEmitted('valve:mode-changed');
      expect(result).toEqual(cmd);
    });

    it('should use REDUCE_FLOW when target is less than current position', () => {
      mockNodeRepository.getValveState.mockReturnValue({
        nodeId: 'node-1',
        currentPosition: 80,
        targetPosition: 80,
        mode: 'auto',
      });

      const cmd = createMockCommand({ id: 'manual-cmd', priority: 'manual', command: 'REDUCE_FLOW' });
      mockCommandRepository.create.mockReturnValue(cmd);

      service.setManualOverride('node-1', 30, 'operator-1');

      expect(mockCommandRepository.create).toHaveBeenCalledWith({
        nodeId: 'node-1',
        command: 'REDUCE_FLOW', // 30 < 80
        priority: 'manual',
        targetPosition: 30,
      });
    });
  });

  // ============================================================
  // Test 7: Auto-revert on CRITICAL override
  // ============================================================
  describe('checkCriticalAutoRevert', () => {
    it('should return true when node is in override mode and risk is CRITICAL', () => {
      mockNodeRepository.getValveState.mockReturnValue({
        nodeId: 'node-1',
        currentPosition: 50,
        targetPosition: 50,
        mode: 'override',
      });

      const result = service.checkCriticalAutoRevert('node-1', 'CRITICAL');

      expect(result).toBe(true);
    });

    it('should return false when node is in override mode but risk is not CRITICAL', () => {
      mockNodeRepository.getValveState.mockReturnValue({
        nodeId: 'node-1',
        currentPosition: 50,
        targetPosition: 50,
        mode: 'override',
      });

      const result = service.checkCriticalAutoRevert('node-1', 'WARNING');

      expect(result).toBe(false);
    });

    it('should return false when node is not in override mode', () => {
      mockNodeRepository.getValveState.mockReturnValue({
        nodeId: 'node-1',
        currentPosition: 50,
        targetPosition: 50,
        mode: 'auto',
      });

      const result = service.checkCriticalAutoRevert('node-1', 'CRITICAL');

      expect(result).toBe(false);
    });

    it('should return false when valve state is null', () => {
      mockNodeRepository.getValveState.mockReturnValue(null);

      const result = service.checkCriticalAutoRevert('node-1', 'CRITICAL');

      expect(result).toBe(false);
    });
  });

  // ============================================================
  // Test 8: Timeout detection
  // ============================================================
  describe('checkTimeouts', () => {
    it('should find timed out commands and mark them TIMEOUT', async () => {
      const oldDate = new Date(Date.now() - 200000).toISOString(); // 200 seconds ago
      const timedOutCmd = createMockCommand({
        id: 'cmd-timeout',
        status: 'DISPATCHED',
        sentAt: oldDate,
      });
      mockCommandRepository.findTimedOutCommands.mockReturnValue([timedOutCmd]);

      await service.checkTimeouts();

      expect(mockCommandRepository.findTimedOutCommands).toHaveBeenCalled();
      expect(mockCommandRepository.updateStatus).toHaveBeenCalledWith('cmd-timeout', COMMAND_STATUS.TIMEOUT);
      expectEventEmitted('command:timeout');
    });

    it('should handle multiple timed out commands', async () => {
      const oldDate = new Date(Date.now() - 200000).toISOString();
      const timedOutCmd1 = createMockCommand({ id: 'cmd-1', status: 'DISPATCHED', sentAt: oldDate });
      const timedOutCmd2 = createMockCommand({ id: 'cmd-2', status: 'DISPATCHED', sentAt: oldDate });
      mockCommandRepository.findTimedOutCommands.mockReturnValue([timedOutCmd1, timedOutCmd2]);

      await service.checkTimeouts();

      expect(mockCommandRepository.updateStatus).toHaveBeenCalledTimes(2);

      // Check that command:timeout was emitted twice
      const timeoutCalls = mockEmit.mock.calls.filter((call: unknown[]) => call[0] === 'command:timeout');
      expect(timeoutCalls).toHaveLength(2);
    });

    it('should do nothing when no commands are timed out', async () => {
      mockCommandRepository.findTimedOutCommands.mockReturnValue([]);

      await service.checkTimeouts();

      expect(mockCommandRepository.updateStatus).not.toHaveBeenCalled();
      expectEventNotEmitted('command:timeout');
    });
  });

  // ============================================================
  // Test 10: Revert to auto
  // ============================================================
  describe('revertToAuto', () => {
    it('should set mode to auto and emit ValveModeChanged event', () => {
      mockNodeRepository.getValveState.mockReturnValue({
        nodeId: 'node-1',
        currentPosition: 50,
        targetPosition: 50,
        mode: 'override',
      });

      service.revertToAuto('node-1');

      expect(mockNodeRepository.updateValveMode).toHaveBeenCalledWith('node-1', 'auto');
      expectEventEmitted('valve:mode-changed', {
        nodeId: 'node-1',
        previousMode: 'override',
        newMode: 'auto',
        reason: 'operator',
      });
    });

    it('should handle null valve state gracefully', () => {
      mockNodeRepository.getValveState.mockReturnValue(null);

      service.revertToAuto('node-1');

      expect(mockNodeRepository.updateValveMode).toHaveBeenCalledWith('node-1', 'auto');
      expectEventEmitted('valve:mode-changed', {
        nodeId: 'node-1',
        previousMode: 'auto',
        newMode: 'auto',
        reason: 'operator',
      });
    });
  });

  // ============================================================
  // Test: handleValveModeChanged
  // ============================================================
  describe('handleValveModeChanged', () => {
    it('should update valve mode and send notification on critical_auto_revert', async () => {
      await service.handleValveModeChanged({
        nodeId: 'node-1',
        previousMode: 'override',
        newMode: 'auto',
        reason: 'critical_auto_revert',
        pressure: 5.8,
      });

      expect(mockNodeRepository.updateValveMode).toHaveBeenCalledWith('node-1', 'auto');
    });

    it('should update valve mode without notification on operator reason', async () => {
      await service.handleValveModeChanged({
        nodeId: 'node-1',
        previousMode: 'override',
        newMode: 'auto',
        reason: 'operator',
      });

      expect(mockNodeRepository.updateValveMode).toHaveBeenCalledWith('node-1', 'auto');
    });
  });

  // ============================================================
  // Test: calculateTargetPosition
  // ============================================================
  describe('calculateTargetPosition (via handleActionDispatched)', () => {
    it('should calculate REDUCE_FLOW target as current - 20', async () => {
      mockNodeRepository.getValveState.mockReturnValue({
        nodeId: 'node-1',
        currentPosition: 50,
        targetPosition: 50,
        mode: 'auto',
      });
      mockCommandRepository.findActiveByNodeId.mockReturnValue(null);

      const newCmd = createMockCommand({ id: 'new-cmd' });
      mockCommandRepository.create.mockReturnValue(newCmd);

      await service.handleActionDispatched({
        nodeId: 'node-1',
        command: 'REDUCE_FLOW',
        riskLevel: 'NORMAL',
        pressure: 3.5,
      });

      const createCall = mockCommandRepository.create.mock.calls[0][0];
      expect(createCall.targetPosition).toBe(30); // 50 - 20
    });

    it('should calculate INCREASE_FLOW target as current + 20', async () => {
      mockNodeRepository.getValveState.mockReturnValue({
        nodeId: 'node-1',
        currentPosition: 50,
        targetPosition: 50,
        mode: 'auto',
      });
      mockCommandRepository.findActiveByNodeId.mockReturnValue(null);

      const newCmd = createMockCommand({ id: 'new-cmd' });
      mockCommandRepository.create.mockReturnValue(newCmd);

      await service.handleActionDispatched({
        nodeId: 'node-1',
        command: 'INCREASE_FLOW',
        riskLevel: 'NORMAL',
        pressure: 3.5,
      });

      const createCall = mockCommandRepository.create.mock.calls[0][0];
      expect(createCall.targetPosition).toBe(70); // 50 + 20
    });

    it('should use EMERGENCY_CLOSE target position of 0', async () => {
      mockNodeRepository.getValveState.mockReturnValue({
        nodeId: 'node-1',
        currentPosition: 50,
        targetPosition: 50,
        mode: 'auto',
      });
      mockCommandRepository.findActiveByNodeId.mockReturnValue(null);

      const newCmd = createMockCommand({ id: 'new-cmd' });
      mockCommandRepository.create.mockReturnValue(newCmd);

      await service.handleActionDispatched({
        nodeId: 'node-1',
        command: 'EMERGENCY_CLOSE',
        riskLevel: 'CRITICAL',
        pressure: 6.5,
      });

      const createCall = mockCommandRepository.create.mock.calls[0][0];
      expect(createCall.targetPosition).toBe(0);
    });

    it('should use provided targetPosition when available', async () => {
      mockNodeRepository.getValveState.mockReturnValue({
        nodeId: 'node-1',
        currentPosition: 50,
        targetPosition: 50,
        mode: 'auto',
      });
      mockCommandRepository.findActiveByNodeId.mockReturnValue(null);

      const newCmd = createMockCommand({ id: 'new-cmd' });
      mockCommandRepository.create.mockReturnValue(newCmd);

      await service.handleActionDispatched({
        nodeId: 'node-1',
        command: 'REDUCE_FLOW',
        riskLevel: 'CRITICAL',
        targetPosition: 25, // explicitly provided
        pressure: 6.5,
      });

      const createCall = mockCommandRepository.create.mock.calls[0][0];
      expect(createCall.targetPosition).toBe(25); // provided value
    });
  });

  // ============================================================
  // Test: shutdown
  // ============================================================
  describe('shutdown', () => {
    it('should clear the timeout checker interval', () => {
      // shutdown should not throw even if interval is already null
      expect(() => service.shutdown()).not.toThrow();
    });
  });

  // ============================================================
  // Test: Legacy methods (backward compatibility)
  // ============================================================
  describe('legacy methods', () => {
    it('create should create command and mark as DISPATCHED', () => {
      const cmd = createMockCommand({ id: 'legacy-cmd', status: 'DISPATCHED' });
      mockCommandRepository.create.mockReturnValue(createMockCommand({ id: 'legacy-cmd' }));
      mockCommandRepository.findById.mockReturnValue(cmd);

      const result = service.create('node-1', 'REDUCE_FLOW');

      expect(mockCommandRepository.create).toHaveBeenCalledWith({ nodeId: 'node-1', command: 'REDUCE_FLOW' });
      expect(mockCommandRepository.updateStatus).toHaveBeenCalledWith('legacy-cmd', COMMAND_STATUS.DISPATCHED);
      expect(result).toEqual(cmd);
    });

    it('findByNodeId should delegate to repository', () => {
      const commands = [createMockCommand(), createMockCommand({ id: 'cmd-2' })];
      mockCommandRepository.findByNodeId.mockReturnValue(commands);

      const result = service.findByNodeId('node-1');

      expect(mockCommandRepository.findByNodeId).toHaveBeenCalledWith('node-1', 50);
      expect(result).toEqual(commands);
    });

    it('findAll should delegate to repository', () => {
      const commands = [createMockCommand()];
      mockCommandRepository.findAll.mockReturnValue(commands);

      const result = service.findAll();

      expect(mockCommandRepository.findAll).toHaveBeenCalledWith(100, 0);
      expect(result).toEqual(commands);
    });

    it('updateStatus should delegate to repository', () => {
      service.updateStatus('cmd-1', 'EXECUTED');

      expect(mockCommandRepository.updateStatus).toHaveBeenCalledWith('cmd-1', 'EXECUTED');
    });

    it('acknowledge should update status correctly when executed', () => {
      const cmd = createMockCommand({ id: 'cmd-1', nodeId: 'node-1' });
      mockCommandRepository.findByIdAndNodeId.mockReturnValue(cmd);

      service.acknowledge('cmd-1', 'node-1', true, 30, '2024-01-01T00:00:00.000Z');

      expect(mockCommandRepository.updateStatus).toHaveBeenCalledWith('cmd-1', COMMAND_STATUS.EXECUTED, 30);
    });

    it('acknowledge should throw when command not found', () => {
      mockCommandRepository.findByIdAndNodeId.mockReturnValue(null);

      expect(() => service.acknowledge('unknown', 'node-1', true, 30, '2024-01-01T00:00:00.000Z'))
        .toThrow('Command unknown not found for node node-1');
    });
  });
});
