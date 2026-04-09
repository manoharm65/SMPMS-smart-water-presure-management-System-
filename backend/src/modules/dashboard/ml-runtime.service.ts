import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../../core/config.js';
import { nodeRepository } from '../../repositories/node.repository.js';
import { telemetryRepository } from '../../repositories/telemetry.repository.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '../../../');

type MlRunStatus = 'idle' | 'running' | 'ok' | 'error';

export const ML_SIMULATION_SCENARIOS = [
  'normal',
  'sudden_drop_no_action_supply_off',
  'high_flow_low_pressure',
  'erratic_pressure_sensor_issue',
  'valve_fault_signature',
  'construction_damage_signature',
  'old_pipe_degradation_signature',
] as const;

export type MlSimulationScenario = typeof ML_SIMULATION_SCENARIOS[number] | 'all';

export interface MlSimulationResult {
  scenario: string;
  pressure: number;
  flow_rate: number;
  supply_on: number;
  control_action: number;
  unexplained_pressure_drop: number;
  anomaly_flag: number;
  anomaly_score: number;
  anomaly_threshold: number;
  predicted_possible_problem: string;
  possible_problem_if_condition_persists: string;
  ml_model_message: string;
  top3_probable_problems: string;
}

export interface MlRuntimeStatus {
  schedulerEnabled: boolean;
  schedulerIntervalMs: number;
  status: MlRunStatus;
  isRunning: boolean;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastDurationMs?: number;
  lastError?: string;
  inputRows?: number;
  outputRows?: number;
  predictionsCsvPath: string;
  modelPath: string;
}

function resolveBackendPath(pathLike: string): string {
  if (!pathLike) return pathLike;
  if (pathLike.includes(':') || pathLike.startsWith('/') || pathLike.startsWith('\\')) {
    return pathLike;
  }
  return resolve(backendRoot, pathLike);
}

function toCsvValue(v: string | number): string {
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function readBoolEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function readFirstDefinedEnv(names: string[], defaultValue: string): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return defaultValue;
}

export class MlRuntimeService {
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private status: MlRunStatus = 'idle';
  private lastRunAt?: string;
  private lastSuccessAt?: string;
  private lastDurationMs?: number;
  private lastError?: string;
  private inputRows = 0;
  private outputRows = 0;

  private readonly schedulerEnabled: boolean;
  private readonly schedulerIntervalMs: number;
  private readonly pythonBin: string;
  private readonly modelPath: string;
  private readonly trainDataPath: string;
  private readonly inputPath: string;
  private readonly predictionsPath: string;
  private readonly simulationOutPath: string;

  constructor() {
    this.schedulerEnabled = readBoolEnv(
      'ML_AUTORUN_ENABLED',
      readBoolEnv('ML_REFRESH_ENABLED', true)
    );
    this.schedulerIntervalMs = parseInt(
      readFirstDefinedEnv(['ML_AUTORUN_INTERVAL_MS', 'ML_REFRESH_INTERVAL_MS'], '300000'),
      10
    );
    this.pythonBin = readFirstDefinedEnv(['ML_PYTHON_BIN', 'ML_PYTHON_CMD'], 'python');
    this.modelPath = resolveBackendPath(readFirstDefinedEnv(['ML_MODEL_FILE'], './ml/artifacts/leakage_model.joblib'));
    this.trainDataPath = resolveBackendPath(process.env.ML_TRAIN_DATA_CSV || './ml/data/synthetic_training_data.csv');
    this.inputPath = resolveBackendPath(
      readFirstDefinedEnv(['ML_PREDICT_INPUT_CSV', 'ML_INFERENCE_INPUT_CSV'], './ml/artifacts/runtime_input.csv')
    );
    this.predictionsPath = resolveBackendPath(config.mlPredictionsCsvPath);
    this.simulationOutPath = resolveBackendPath(
      readFirstDefinedEnv(['ML_SIMULATION_OUTPUT_CSV'], './ml/artifacts/scenario_simulation_results.csv')
    );
  }

  getSimulationScenarios(): readonly string[] {
    return ML_SIMULATION_SCENARIOS;
  }

  async simulateCondition(scenario: MlSimulationScenario = 'all'): Promise<MlSimulationResult[]> {
    if (scenario !== 'all' && !ML_SIMULATION_SCENARIOS.includes(scenario)) {
      throw new Error(`Invalid scenario: ${scenario}`);
    }

    await this.ensureModelExists();

    const simulateScript = resolve(backendRoot, 'ml/simulate_conditions.py');
    mkdirSync(dirname(this.simulationOutPath), { recursive: true });

    const args = [
      simulateScript,
      '--model',
      this.modelPath,
      '--scenario',
      scenario,
      '--out',
      this.simulationOutPath,
      '--json-stdout',
    ];

    const { stdout } = await this.runProcessCapture(this.pythonBin, args, 'simulate');

    const startMarker = 'JSON_RESULT_START';
    const endMarker = 'JSON_RESULT_END';
    const start = stdout.indexOf(startMarker);
    const end = stdout.indexOf(endMarker);
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Simulation output did not contain JSON markers');
    }

    const jsonText = stdout.slice(start + startMarker.length, end).trim();
    const parsed = JSON.parse(jsonText) as { results?: MlSimulationResult[] };
    return parsed.results ?? [];
  }

  startScheduler(): void {
    if (!this.schedulerEnabled) {
      console.log('[MLRuntime] Scheduler disabled by ML_AUTORUN_ENABLED=false');
      return;
    }

    if (this.schedulerInterval) return;

    const intervalMs = Math.max(this.schedulerIntervalMs, 60000);
    this.schedulerInterval = setInterval(() => {
      void this.runPredictionNow('scheduler');
    }, intervalMs);

    console.log(`[MLRuntime] Scheduler started (${intervalMs}ms)`);

    // Initial non-blocking warm-up run
    void this.runPredictionNow('startup');
  }

  shutdown(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  getStatus(): MlRuntimeStatus {
    return {
      schedulerEnabled: this.schedulerEnabled,
      schedulerIntervalMs: Math.max(this.schedulerIntervalMs, 60000),
      status: this.status,
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      lastSuccessAt: this.lastSuccessAt,
      lastDurationMs: this.lastDurationMs,
      lastError: this.lastError,
      inputRows: this.inputRows,
      outputRows: this.outputRows,
      predictionsCsvPath: this.predictionsPath,
      modelPath: this.modelPath,
    };
  }

  async runPredictionNow(trigger: 'api' | 'scheduler' | 'startup' = 'api'): Promise<MlRuntimeStatus> {
    if (this.isRunning) {
      return this.getStatus();
    }

    this.isRunning = true;
    this.status = 'running';
    this.lastError = undefined;
    this.lastRunAt = new Date().toISOString();
    const started = Date.now();

    try {
      this.inputRows = this.buildRuntimeInputCsv();
      await this.ensureModelExists();
      await this.runPredictScript();
      this.outputRows = this.countCsvRows(this.predictionsPath);
      this.status = 'ok';
      this.lastSuccessAt = new Date().toISOString();
      this.lastDurationMs = Date.now() - started;
      console.log(`[MLRuntime] Prediction run success (${trigger}) rowsIn=${this.inputRows} rowsOut=${this.outputRows}`);
    } catch (err: any) {
      this.status = 'error';
      this.lastDurationMs = Date.now() - started;
      this.lastError = err?.message || String(err);
      console.error(`[MLRuntime] Prediction run failed (${trigger}):`, err);
    } finally {
      this.isRunning = false;
    }

    return this.getStatus();
  }

  private buildRuntimeInputCsv(): number {
    const nodes = nodeRepository.findAll();
    const rows: Array<{
      timestamp: string;
      node_id: string;
      pressure: number;
      flow_rate: number;
      valve_position: number;
      supply_on: number;
      control_action: number;
      neighbor_pressure: number;
      pipe_age_years: number;
      construction_flag: number;
    }> = [];

    for (const node of nodes) {
      const telemetry = telemetryRepository.findByNodeId(node.nodeId, 200);
      const ascending = telemetry.slice().reverse();

      for (const t of ascending) {
        const hour = new Date(t.timestamp).getHours();
        const supplyOn = hour >= 5 && hour <= 22 ? 1 : 0;

        rows.push({
          timestamp: t.timestamp,
          node_id: node.nodeId,
          pressure: t.pressure,
          flow_rate: t.flowRate ?? 0,
          valve_position: t.valvePosition ?? node.valvePosition ?? 50,
          supply_on: supplyOn,
          control_action: 0,
          neighbor_pressure: t.pressure,
          pipe_age_years: 12,
          construction_flag: 0,
        });
      }
    }

    rows.sort((a, b) => {
      const nodeCmp = a.node_id.localeCompare(b.node_id);
      if (nodeCmp !== 0) return nodeCmp;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    mkdirSync(dirname(this.inputPath), { recursive: true });

    const header = [
      'timestamp',
      'node_id',
      'pressure',
      'flow_rate',
      'valve_position',
      'supply_on',
      'control_action',
      'neighbor_pressure',
      'pipe_age_years',
      'construction_flag',
    ].join(',');

    const body = rows
      .map((r) => [
        toCsvValue(r.timestamp),
        toCsvValue(r.node_id),
        toCsvValue(r.pressure),
        toCsvValue(r.flow_rate),
        toCsvValue(r.valve_position),
        toCsvValue(r.supply_on),
        toCsvValue(r.control_action),
        toCsvValue(r.neighbor_pressure),
        toCsvValue(r.pipe_age_years),
        toCsvValue(r.construction_flag),
      ].join(','))
      .join('\n');

    writeFileSync(this.inputPath, `${header}\n${body}\n`, 'utf-8');
    return rows.length;
  }

  private async ensureModelExists(): Promise<void> {
    if (existsSync(this.modelPath)) {
      return;
    }

    if (!existsSync(this.trainDataPath)) {
      throw new Error(
        `ML model missing and training data not found at ${this.trainDataPath}. Generate training data or set ML_TRAIN_DATA_CSV.`
      );
    }

    const trainScript = resolve(backendRoot, 'ml/train.py');
    const args = [
      trainScript,
      '--data',
      this.trainDataPath,
      '--out',
      this.modelPath,
    ];

    await this.runProcess(this.pythonBin, args, 'train');
  }

  private async runPredictScript(): Promise<void> {
    const predictScript = resolve(backendRoot, 'ml/predict.py');
    mkdirSync(dirname(this.predictionsPath), { recursive: true });

    const args = [
      predictScript,
      '--model',
      this.modelPath,
      '--data',
      this.inputPath,
      '--out',
      this.predictionsPath,
    ];

    await this.runProcess(this.pythonBin, args, 'predict');
  }

  private runProcess(command: string, args: string[], label: string): Promise<void> {
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(command, args, {
        cwd: backendRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';

      child.stdout.on('data', (buf) => {
        const text = String(buf).trim();
        if (text) {
          console.log(`[MLRuntime:${label}] ${text}`);
        }
      });

      child.stderr.on('data', (buf) => {
        const text = String(buf).trim();
        if (text) {
          stderr += `${text}\n`;
          console.error(`[MLRuntime:${label}] ${text}`);
        }
      });

      child.on('error', (err) => {
        rejectPromise(new Error(`Failed to start ${label} process: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolvePromise();
          return;
        }
        rejectPromise(new Error(`${label} process exited with code ${code}. ${stderr.trim()}`));
      });
    });
  }

  private runProcessCapture(command: string, args: string[], label: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(command, args, {
        cwd: backendRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (buf) => {
        const text = String(buf);
        stdout += text;
        const trimmed = text.trim();
        if (trimmed) {
          console.log(`[MLRuntime:${label}] ${trimmed}`);
        }
      });

      child.stderr.on('data', (buf) => {
        const text = String(buf);
        stderr += text;
        const trimmed = text.trim();
        if (trimmed) {
          console.error(`[MLRuntime:${label}] ${trimmed}`);
        }
      });

      child.on('error', (err) => {
        rejectPromise(new Error(`Failed to start ${label} process: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolvePromise({ stdout, stderr });
          return;
        }
        rejectPromise(new Error(`${label} process exited with code ${code}. ${stderr.trim()}`));
      });
    });
  }

  private countCsvRows(path: string): number {
    if (!existsSync(path)) return 0;
    const text = readFileSync(path, 'utf-8').trim();
    if (!text) return 0;
    const lines = text.split(/\r?\n/);
    return Math.max(0, lines.length - 1);
  }
}

export const mlRuntimeService = new MlRuntimeService();
