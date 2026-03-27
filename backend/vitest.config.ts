import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Only measure coverage for the files that have active unit tests.
      // Excludes: controllers (not unit tested), repositories, decision.service.ts,
      // new infrastructure files (tested via integration tests, not unit tests).
      include: [
        'src/modules/decision/rule.engine.ts',
        'src/modules/command/command.service.ts',
        'src/modules/telemetry/telemetry.service.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
