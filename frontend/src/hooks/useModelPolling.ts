import { useEffect, useRef, useCallback } from 'react'
import { useModelHubStore } from '../store/modelHubStore'
import { useControlStore } from '../store/controlStore'

export type PollingConfig = {
  enabled?: boolean
  intervalMs?: number
  modelsEnabled?: boolean
  controlEnabled?: boolean
}

export function useModelPolling(config: PollingConfig = {}) {
  const {
    enabled = true,
    intervalMs = 30000,
    modelsEnabled = true,
    controlEnabled = false,
  } = config

  const refreshAll = useModelHubStore((s) => s.refreshAll)
  const fetchControlState = useControlStore((s) => s.fetchControlState)

  const savedRefresh = useRef(refreshAll)
  const savedFetchControl = useRef(fetchControlState)

  useEffect(() => {
    savedRefresh.current = refreshAll
  }, [refreshAll])

  useEffect(() => {
    savedFetchControl.current = fetchControlState
  }, [fetchControlState])

  const tick = useCallback(async () => {
    if (!enabled) return

    const promises: Promise<void>[] = []

    if (modelsEnabled) {
      promises.push(savedRefresh.current())
    }

    if (controlEnabled) {
      promises.push(savedFetchControl.current())
    }

    await Promise.all(promises).catch(console.error)
  }, [enabled, modelsEnabled, controlEnabled])

  useEffect(() => {
    if (!enabled) return

    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs, tick])

  return {
    refresh: tick,
  }
}

export function useModelHubPolling(intervalMs = 30000) {
  const refreshAll = useModelHubStore((s) => s.refreshAll)
  const loading = useModelHubStore((s) => s.loading)

  const savedRefresh = useRef(refreshAll)

  useEffect(() => {
    savedRefresh.current = refreshAll
  }, [refreshAll])

  useEffect(() => {
    if (loading) {
      savedRefresh.current()
    }
  }, [loading])

  useEffect(() => {
    const id = setInterval(() => {
      savedRefresh.current()
    }, intervalMs)

    return () => clearInterval(id)
  }, [intervalMs])

  return { refresh: refreshAll }
}

export function useTelemetryPolling(intervalMs = 1000) {
  const fetchIwedsNodeData = useModelHubStore((s) => s.fetchIwedsNodeData)
  const activeTab = useModelHubStore((s) => s.activeTab)

  const savedFetch = useRef(fetchIwedsNodeData)

  useEffect(() => {
    savedFetch.current = fetchIwedsNodeData
  }, [fetchIwedsNodeData])

  useEffect(() => {
    if (activeTab !== 'iweds') return

    const id = setInterval(() => {
      savedFetch.current()
    }, intervalMs)

    return () => clearInterval(id)
  }, [intervalMs, activeTab])

  return { refresh: fetchIwedsNodeData }
}

export function useControlPolling(intervalMs = 15000) {
  const fetchControlState = useControlStore((s) => s.fetchControlState)
  const loading = useControlStore((s) => s.loading)

  const savedFetch = useRef(fetchControlState)

  useEffect(() => {
    savedFetch.current = fetchControlState
  }, [fetchControlState])

  useEffect(() => {
    if (loading) {
      savedFetch.current()
    }
  }, [loading])

  useEffect(() => {
    const id = setInterval(() => {
      savedFetch.current()
    }, intervalMs)

    return () => clearInterval(id)
  }, [intervalMs])

  return { refresh: fetchControlState }
}