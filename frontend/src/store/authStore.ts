import { create } from 'zustand'
import { apiGet, apiPost } from '../services/api'

type AuthUser = { id: string; username: string; email?: string }

type AuthState = {
  token: string | null
  user: AuthUser | null
  status: 'idle' | 'loading' | 'authenticated' | 'error'
  error: string | null

  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  hydrate: () => void
  fetchMe: () => Promise<void>
}

const STORAGE_KEY = 'aquabytes.token'

function readInitialToken() {
  if (typeof window === 'undefined') return null
  try {
    const t = localStorage.getItem(STORAGE_KEY)
    return t && t.trim().length > 0 ? t : null
  } catch {
    return null
  }
}

const initialToken = readInitialToken()

export const useAuthStore = create<AuthState>((set, get) => ({
  token: initialToken,
  user: null,
  status: initialToken ? 'authenticated' : 'idle',
  error: null,

  hydrate: () => {
    const token = localStorage.getItem(STORAGE_KEY)
    if (token && token.trim().length > 0) {
      set({ token, status: 'authenticated', error: null })
    }
  },

  login: async (username, password) => {
    set({ status: 'loading', error: null })
    try {
      const res = await apiPost<{ token: string; user: AuthUser }>('/api/auth/login', { username, password })
      localStorage.setItem(STORAGE_KEY, res.token)
      set({ token: res.token, user: res.user, status: 'authenticated', error: null })
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? 'Login failed', token: null, user: null })
      throw e
    }
  },

  register: async (username, password) => {
    set({ status: 'loading', error: null })
    try {
      const res = await apiPost<{ token: string; user: AuthUser }>('/api/auth/register', { username, password })
      localStorage.setItem(STORAGE_KEY, res.token)
      set({ token: res.token, user: res.user, status: 'authenticated', error: null })
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? 'Sign up failed', token: null, user: null })
      throw e
    }
  },

  fetchMe: async () => {
    const token = get().token
    if (!token) return
    const res = await apiGet<{ user: AuthUser }>('/api/auth/me', { token })
    set({ user: res.user })
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ token: null, user: null, status: 'idle', error: null })
  },
}))
