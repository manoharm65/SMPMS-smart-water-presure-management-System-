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

export type MapMode = 'map' | 'dma'

type DashboardState = {
  connection: SocketStatus
  mapMode: MapMode
  selectedDmaId: string | null
  hardwareModeEnabled: boolean
  activeHardwareDmaId: string | null
  selectedValveId: string | null
  selectedPipelineId: string | null
  mapDataStatus: 'demo' | 'loading' | 'ready' | 'error'
  zones: Record<string, ZoneTelemetry>
  valves: Valve[]
  pipelines: PipelineSegment[]
  zonesGeo: ZoneGeo[]

  setConnection: (status: SocketStatus) => void
  setMapMode: (mode: MapMode) => void
  selectDma: (dmaId: string | null) => void
  setHardwareModeEnabled: (enabled: boolean) => void
  setActiveHardwareDma: (dmaId: string | null) => void
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

function statusFromTelemetry(evt: PressureUpdateEvent): PressureStatus {
  if (evt.anomalyScore >= 0.85) return 'critical'
  if (evt.anomalyScore >= 0.65) return 'warning'
  return statusFromPressure(evt.pressure)
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  connection: { status: 'offline' },
  mapMode: 'map',
  selectedDmaId: null,
  hardwareModeEnabled: false,
  activeHardwareDmaId: null,
  selectedValveId: null,
  selectedPipelineId: null,
  mapDataStatus: 'loading',
  zones: {},
  valves: [],
  pipelines: [],
  zonesGeo: [],

  setConnection: (status) => set({ connection: status }),
  setMapMode: (mode) => set({ mapMode: mode }),
  selectDma: (dmaId) =>
    set({
      selectedDmaId: dmaId,
      selectedPipelineId: null,
      selectedValveId: null,
    }),
  setHardwareModeEnabled: (enabled) => set({ hardwareModeEnabled: enabled }),
  setActiveHardwareDma: (dmaId) => set({ activeHardwareDmaId: dmaId }),
  selectValve: (valveId) =>
    set({ selectedValveId: valveId, selectedPipelineId: null, selectedDmaId: null }),
  selectPipeline: (pipelineId) =>
    set({ selectedPipelineId: pipelineId, selectedValveId: null, selectedDmaId: null }),
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
          status: statusFromTelemetry(evt),
          updatedAt: Date.now(),
        },
      },
    }))
  },
}))
