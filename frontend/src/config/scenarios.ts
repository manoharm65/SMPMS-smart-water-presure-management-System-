export interface Scenario {
  id: string
  name: string
  description: string
  type: 'baseline' | 'anomaly' | 'response'
  duration_seconds: number
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'baseline',
    name: 'Baseline Operations',
    description: 'Normal operations without any disturbances or interventions',
    type: 'baseline',
    duration_seconds: 300,
  },
  {
    id: 'supply_loss',
    name: 'Supply Loss Event',
    description: 'Simulates 40% supply pressure loss at node VALVE_1',
    type: 'anomaly',
    duration_seconds: 180,
  },
  {
    id: 'pipe_burst',
    name: 'Pipe Burst Detection',
    description: 'Simulates pipe burst causing pressure drop across network',
    type: 'anomaly',
    duration_seconds: 180,
  },
  {
    id: 'demand_surge',
    name: 'Demand Surge Event',
    description: 'Simulates 60% flow increase at VALVE_3 and VALVE_4',
    type: 'anomaly',
    duration_seconds: 180,
  },
  {
    id: 'pump_failure',
    name: 'Pump Failure Scenario',
    description: 'Simulates primary pump failure at zone A',
    type: 'anomaly',
    duration_seconds: 180,
  },
  {
    id: 'leak_response',
    name: 'Automated Leak Response',
    description: 'Tests automated response to detected leak',
    type: 'response',
    duration_seconds: 180,
  },
  {
    id: 'pressure_control',
    name: 'Pressure Override Control',
    description: 'Tests manual pressure setpoint override',
    type: 'response',
    duration_seconds: 180,
  },
]

export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find(s => s.id === id)
}

export function getScenariosByType(type: Scenario['type']): Scenario[] {
  return SCENARIOS.filter(s => s.type === type)
}