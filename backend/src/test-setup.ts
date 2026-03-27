import { vi } from 'vitest';

// ============================================================
// Mock config — must be set before any module imports that use it
// ============================================================
const mockConfig = {
  port: 8080,
  sqliteDbPath: ':memory:',
  jwtSecret: 'test-jwt-secret',
  telegramBotToken: '',
  telegramChatId: '',
  telemetryIntervalMs: 60000,
  commandTimeoutCheckMs: 30000,
  commandTimeoutCycles: 3,
  // Pressure thresholds
  pressureCriticalHigh: 5.5,
  pressureWarningHigh: 4.5,
  pressureNormalLow: 2.5,
  pressureCriticalLow: 1.5,
  pressureMinThreshold: 2.0,
  pressureMaxThreshold: 6.0,
};

vi.mock('./core/config.js', () => ({
  config: mockConfig,
  loadEnv: vi.fn(),
  getConfig: vi.fn(() => mockConfig),
}));

// ============================================================
// Mock event bus — clean each test
// (Note: unit test files override this with their own vi.mock if needed)
// ============================================================
vi.mock('./core/event-bus.js', () => {
  const events: Record<string, Array<(...args: unknown[]) => void>> = {};

  const mockEmit = vi.fn((event: string, payload: unknown) => {
    const handlers = events[event] || [];
    handlers.forEach((h) => h(payload));
  });

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
// Helper — reset all mocks between tests
// ============================================================
beforeEach(() => {
  vi.clearAllMocks();
});
