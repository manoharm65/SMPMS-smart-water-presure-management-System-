import type { LatLngTuple } from 'leaflet'
import { create } from 'zustand'
import type { SocketStatus } from '../services/socket'

export type PressureStatus = 'normal' | 'low' | 'warning' | 'critical'

export type PressureUpdateEvent = {
  zoneId: string
  pressure: number
  valvePosition: number
  flowRate: number
  anomalyScore: number
}

export type ZoneTelemetry = PressureUpdateEvent & {
  zoneName: string
  status: PressureStatus
  updatedAt: number
}

export type Valve = {
  id: string
  name: string
  zoneId: string
  position: LatLngTuple
  properties?: Record<string, unknown>
}

export type PipelineSegment = {
  id: string
  zoneId: string
  path: LatLngTuple[]
  properties?: Record<string, unknown>
}

export type ZoneGeo = {
  id: string
  name: string
  points: LatLngTuple[]
  centroid: LatLngTuple
}

type DashboardState = {
  connection: SocketStatus
  selectedValveId: string | null
  selectedPipelineId: string | null
  mapDataStatus: 'demo' | 'loading' | 'ready' | 'error'
  zones: Record<string, ZoneTelemetry>
  valves: Valve[]
  pipelines: PipelineSegment[]
  zonesGeo: ZoneGeo[]

  setConnection: (status: SocketStatus) => void
  selectValve: (valveId: string | null) => void
  selectPipeline: (pipelineId: string | null) => void
  upsertTelemetry: (evt: PressureUpdateEvent) => void
  setMapLayers: (layers: {
    zonesGeo: ZoneGeo[]
    pipelines: PipelineSegment[]
    valves: Valve[]
  }) => void
  setMapDataStatus: (status: DashboardState['mapDataStatus']) => void
}

function statusFromPressure(pressure: number): PressureStatus {
  if (pressure < 3.0) return 'low'
  if (pressure >= 7.0) return 'critical'
  if (pressure >= 6.0) return 'warning'
  return 'normal'
}

const seedZones: ZoneGeo[] = [
  {
    id: 'DMA-01',
    name: 'North Gate',
    points: [
      [51.512, -0.102],
      [51.512, -0.078],
      [51.502, -0.078],
      [51.502, -0.102],
    ],
    centroid: [51.507, -0.09],
  },
  {
    id: 'DMA-02',
    name: 'East Spur',
    points: [
      [51.506, -0.078],
      [51.506, -0.06],
      [51.495, -0.06],
      [51.495, -0.078],
    ],
    centroid: [51.5, -0.07],
  },
  {
    id: 'DMA-03',
    name: 'Central Loop',
    points: [
      [51.502, -0.1],
      [51.502, -0.078],
      [51.492, -0.078],
      [51.492, -0.1],
    ],
    centroid: [51.497, -0.089],
  },
  {
    id: 'DMA-04',
    name: 'South Works',
    points: [
      [51.492, -0.104],
      [51.492, -0.084],
      [51.484, -0.084],
      [51.484, -0.104],
    ],
    centroid: [51.488, -0.094],
  },
  {
    id: 'DMA-05',
    name: 'West Ridge',
    points: [
      [51.508, -0.12],
      [51.508, -0.102],
      [51.495, -0.102],
      [51.495, -0.12],
    ],
    centroid: [51.501, -0.111],
  },
]

const seedValves: Valve[] = [
  { id: 'V-001', name: 'Valve V-001', zoneId: 'DMA-01', position: [51.509, -0.095] },
  { id: 'V-002', name: 'Valve V-002', zoneId: 'DMA-02', position: [51.501, -0.068] },
  { id: 'V-003', name: 'Valve V-003', zoneId: 'DMA-03', position: [51.497, -0.087] },
  { id: 'V-004', name: 'Valve V-004', zoneId: 'DMA-04', position: [51.487, -0.096] },
  { id: 'V-005', name: 'Valve V-005', zoneId: 'DMA-05', position: [51.503, -0.112] },
]

const seedPipelines: PipelineSegment[] = [
  {
    id: 'P-01',
    zoneId: 'DMA-01',
    path: [
      [51.507, -0.1],
      [51.509, -0.095],
      [51.508, -0.085],
    ],
  },
  {
    id: 'P-02',
    zoneId: 'DMA-02',
    path: [
      [51.5, -0.078],
      [51.501, -0.068],
      [51.499, -0.06],
    ],
  },
  {
    id: 'P-03',
    zoneId: 'DMA-03',
    path: [
      [51.497, -0.099],
      [51.497, -0.087],
      [51.495, -0.078],
    ],
  },
  {
    id: 'P-04',
    zoneId: 'DMA-04',
    path: [
      [51.49, -0.104],
      [51.487, -0.096],
      [51.485, -0.088],
    ],
  },
  {
    id: 'P-05',
    zoneId: 'DMA-05',
    path: [
      [51.504, -0.12],
      [51.503, -0.112],
      [51.502, -0.104],
    ],
  },
]

export const useDashboardStore = create<DashboardState>((set, get) => ({
  connection: { status: 'offline' },
  selectedValveId: null,
  selectedPipelineId: null,
  mapDataStatus: 'demo',
  zones: Object.fromEntries(
    seedZones.map((z) => [
      z.id,
      {
        zoneId: z.id,
        zoneName: z.name,
        pressure: 5.4,
        valvePosition: 60,
        flowRate: 40,
        anomalyScore: 0.12,
        status: 'normal' as PressureStatus,
        updatedAt: Date.now(),
      },
    ]),
  ),
  valves: seedValves,
  pipelines: seedPipelines,
  zonesGeo: seedZones,

  setConnection: (status) => set({ connection: status }),
  selectValve: (valveId) => set({ selectedValveId: valveId, selectedPipelineId: null }),
  selectPipeline: (pipelineId) => set({ selectedPipelineId: pipelineId, selectedValveId: null }),
  setMapLayers: (layers) =>
    set({
      zonesGeo: layers.zonesGeo,
      pipelines: layers.pipelines,
      valves: layers.valves,
    }),
  setMapDataStatus: (status) => set({ mapDataStatus: status }),
  upsertTelemetry: (evt) => {
    const prev = get().zones[evt.zoneId]
    const zoneName = prev?.zoneName ?? evt.zoneId
    set((state) => ({
      zones: {
        ...state.zones,
        [evt.zoneId]: {
          ...evt,
          zoneName,
          status: statusFromPressure(evt.pressure),
          updatedAt: Date.now(),
        },
      },
    }))
  },
}))
