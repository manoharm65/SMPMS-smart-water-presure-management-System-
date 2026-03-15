export type ApiConfig = {
  baseUrl?: string
}

const defaultBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL as
  | string
  | undefined

export async function apiGet<T>(path: string, cfg?: ApiConfig): Promise<T> {
  const baseUrl = cfg?.baseUrl ?? defaultBaseUrl ?? ''
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`API GET ${path} failed: ${res.status}`)
  }

  return (await res.json()) as T
}
