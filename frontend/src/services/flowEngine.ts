/**
 * Flow Simulation Engine
 * 
 * This module handles real-time water flow simulation in a pipeline system with:
 * - Main pipeline flow distribution to branches
 * - Configurable valve control
 * - Sensor noise for realism
 * - Delay simulation based on pipe length and velocity
 * 
 * Can operate in two modes:
 * - PRODUCTION: Uses real backend API data
 * - DEVELOPMENT: Uses mock simulation
 */

export interface FlowReadings {
  main: number
  branchA: number
  branchB: number
  timestamp: number
}

export interface ValveState {
  openPercent: number
  motorized: boolean
  autoControl: boolean
}

export interface FlowConfig {
  pipeLength: number
  velocity: number
  branchARatio: number
  branchBRatio: number
  noiseLevel: number
  delayMs: number
}

export interface FlowSystemState {
  readings: FlowReadings
  valve: ValveState
  config: FlowConfig
  mode: 'production' | 'development'
}

const DEFAULT_CONFIG: FlowConfig = {
  pipeLength: 100,
  velocity: 2.5,
  branchARatio: 0.5,
  branchBRatio: 0.5,
  noiseLevel: 0.02,
  delayMs: 500,
}

const DEFAULT_VALVE: ValveState = {
  openPercent: 50,
  motorized: false,
  autoControl: true,
}

/**
 * Generate sensor noise for realistic readings
 */
function addSensorNoise(value: number, noiseLevel: number): number {
  const noise = (Math.random() - 0.5) * 2 * noiseLevel * value
  return Math.max(0, value + noise)
}

/**
 * Calculate flow delay based on pipe length and velocity
 * @internal - exported for potential future use
 */
export function calculateDelay(length: number, velocity: number): number {
  return (length / velocity) * 1000
}

/**
 * Split main flow into branches based on valve position
 */
function splitFlow(
  mainFlow: number,
  branchARatio: number,
  branchBRatio: number,
  valveOpenPercent: number
): { branchA: number; branchB: number } {
  const totalRatio = branchARatio + branchBRatio
  const adjustedRatioA = branchARatio / totalRatio
  const adjustedRatioB = branchBRatio / totalRatio
  
  const valveFactor = valveOpenPercent / 100
  const distributedFlow = mainFlow * valveFactor
  
  return {
    branchA: distributedFlow * adjustedRatioA,
    branchB: distributedFlow * adjustedRatioB,
  }
}

/**
 * Create mock flow readings for development mode
 * @internal - used in development mode
 */
export function generateMockReadings(config: FlowConfig): FlowReadings {
  const baseFlow = 80 + Math.random() * 40
  const { branchA, branchB } = splitFlow(
    baseFlow,
    config.branchARatio,
    config.branchBRatio,
    DEFAULT_VALVE.openPercent
  )
  
  return {
    main: Math.round(addSensorNoise(baseFlow, config.noiseLevel) * 10) / 10,
    branchA: Math.round(addSensorNoise(branchA, config.noiseLevel) * 10) / 10,
    branchB: Math.round(addSensorNoise(branchB, config.noiseLevel) * 10) / 10,
    timestamp: Date.now(),
  }
}

/**
 * FlowEngine class - manages the flow simulation
 */
export class FlowEngine {
  private state: FlowSystemState
  private pollingInterval: ReturnType<typeof setInterval> | null = null
  private onUpdate: ((readings: FlowReadings) => void) | null = null
  private mockBaseFlow: number = 100
  
  constructor(mode: 'production' | 'development' = 'development') {
    this.state = {
      readings: {
        main: 0,
        branchA: 0,
        branchB: 0,
        timestamp: Date.now(),
      },
      valve: { ...DEFAULT_VALVE },
      config: { ...DEFAULT_CONFIG },
      mode,
    }
  }
  
  setOnUpdate(callback: (readings: FlowReadings) => void): void {
    this.onUpdate = callback
  }
  
  setValvePosition(percent: number): void {
    this.state.valve.openPercent = Math.max(0, Math.min(100, percent))
  }
  
  setMotorized(enabled: boolean): void {
    this.state.valve.motorized = enabled
  }
  
  setAutoControl(enabled: boolean): void {
    this.state.valve.autoControl = enabled
  }
  
  setBranchRatios(ratioA: number, ratioB: number): void {
    const total = ratioA + ratioB
    this.state.config.branchARatio = ratioA / total
    this.state.config.branchBRatio = ratioB / total
  }
  
  setConfig(config: Partial<FlowConfig>): void {
    this.state.config = { ...this.state.config, ...config }
  }
  
  getState(): FlowSystemState {
    return { ...this.state }
  }
  
  getReadings(): FlowReadings {
    return { ...this.state.readings }
  }
  
  getValve(): ValveState {
    return { ...this.state.valve }
  }
  
  /**
   * Update simulation with new main flow value
   * Called from external source (API or manual input)
   */
  updateMainFlow(mainFlow: number): void {
    if (this.state.mode === 'development') {
      this.mockBaseFlow = mainFlow
    }
    
    const { branchA, branchB } = splitFlow(
      mainFlow,
      this.state.config.branchARatio,
      this.state.config.branchBRatio,
      this.state.valve.openPercent
    )
    
    this.state.readings = {
      main: mainFlow,
      branchA: Math.round(addSensorNoise(branchA, this.state.config.noiseLevel) * 10) / 10,
      branchB: Math.round(addSensorNoise(branchB, this.state.config.noiseLevel) * 10) / 10,
      timestamp: Date.now(),
    }
    
    if (this.onUpdate) {
      this.onUpdate(this.state.readings)
    }
  }
  
  /**
   * Start polling for updates
   * In production: fetches from API
   * In development: generates mock data
   */
  startPolling(intervalMs: number = 1000): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
    }
    
    const poll = async () => {
      if (this.state.mode === 'production') {
        try {
          const response = await fetch('/api/flow/main')
          if (response.ok) {
            const data = await response.json()
            this.updateMainFlow(data.flow)
          }
        } catch (error) {
          console.error('Failed to fetch flow data:', error)
        }
      } else {
        const mockMain = this.mockBaseFlow + (Math.random() - 0.5) * 10
        this.updateMainFlow(Math.max(0, mockMain))
      }
      
      // Timestamp tracking removed for simplicity
    }
    
    poll()
    this.pollingInterval = setInterval(poll, intervalMs)
  }
  
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }
  
  /**
   * Get API endpoints for production mode
   */
  static getApiEndpoints() {
    return {
      mainFlow: '/api/flow/main',
      branchFlow: '/api/flow/branches',
      valveControl: '/api/valve/control',
    }
  }
  
  /**
   * Send valve control to backend
   */
  static async sendValveControl(percent: number, motorized: boolean): Promise<boolean> {
    try {
      const response = await fetch('/api/valve/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openPercent: percent, motorized }),
      })
      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * Singleton instance - exported for use across components
 */
export const flowEngine = new FlowEngine()

export default FlowEngine