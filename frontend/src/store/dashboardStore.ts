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

export const useDashboardStore = create<DashboardState>((set, get) => ({
  connection: { status: 'offline' },
  selectedValveId: null,
  selectedPipelineId: null,
  mapDataStatus: 'loading',
  zones: {},
  valves: [],
  pipelines: [],
  zonesGeo: [],

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
