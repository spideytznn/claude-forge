import { useEffect } from 'react'
import { create } from 'zustand'

export interface AppearanceSettings {
  motionSpeed: number
  glassOpacity: number
  frost: number
}

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  motionSpeed: 100,
  glassOpacity: 92,
  frost: 70
}

const STORAGE_KEY = 'forge.appearance.v1'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function mix(min: number, max: number, amount: number): number {
  return min + (max - min) * amount
}

function cssNumber(value: number): string {
  return value.toFixed(3)
}

function normalizeSettings(value: Partial<AppearanceSettings> | null | undefined): AppearanceSettings {
  return {
    motionSpeed: clamp(Number(value?.motionSpeed ?? DEFAULT_APPEARANCE_SETTINGS.motionSpeed), 70, 150),
    glassOpacity: clamp(Number(value?.glassOpacity ?? DEFAULT_APPEARANCE_SETTINGS.glassOpacity), 65, 100),
    frost: clamp(Number(value?.frost ?? DEFAULT_APPEARANCE_SETTINGS.frost), 0, 100)
  }
}

function readSettings(): AppearanceSettings {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE_SETTINGS

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return normalizeSettings(raw ? (JSON.parse(raw) as Partial<AppearanceSettings>) : null)
  } catch {
    return DEFAULT_APPEARANCE_SETTINGS
  }
}

function saveSettings(settings: AppearanceSettings): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function applyAppearanceSettings(settings: AppearanceSettings): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const normalized = normalizeSettings(settings)
  const durationFactor = 100 / normalized.motionSpeed
  const opacity = (normalized.glassOpacity - 65) / 35
  const blur = 14 + normalized.frost * 0.257
  const ambientOpacity = 0.18 + normalized.frost * 0.00257

  root.style.setProperty('--motion-collapse-open', `${Math.round(550 * durationFactor)}ms`)
  root.style.setProperty('--motion-collapse-close', `${Math.round(480 * durationFactor)}ms`)
  root.style.setProperty('--motion-sidebar', `${Math.round(500 * durationFactor)}ms`)
  root.style.setProperty('--motion-sidebar-content-open', `${Math.round(410 * durationFactor)}ms`)
  root.style.setProperty('--motion-sidebar-content-close', `${Math.round(320 * durationFactor)}ms`)
  root.style.setProperty('--motion-sidebar-content-delay', `${Math.round(50 * durationFactor)}ms`)
  root.style.setProperty('--glass-shell-alpha', cssNumber(mix(0.74, 0.98, opacity)))
  root.style.setProperty('--glass-sidebar-alpha', cssNumber(mix(0.7, 0.95, opacity)))
  root.style.setProperty('--glass-main-alpha', cssNumber(mix(0.72, 0.96, opacity)))
  root.style.setProperty('--glass-panel-alpha', cssNumber(mix(0.54, 0.88, opacity)))
  root.style.setProperty('--glass-soft-alpha', cssNumber(mix(0.4, 0.76, opacity)))
  root.style.setProperty('--glass-control-alpha', cssNumber(mix(0.34, 0.7, opacity)))
  root.style.setProperty('--glass-active-alpha', cssNumber(mix(0.46, 0.8, opacity)))
  root.style.setProperty('--glass-frost-strong-alpha', cssNumber(mix(0.72, 0.98, opacity)))
  root.style.setProperty('--glass-frost-panel-alpha', cssNumber(mix(0.62, 0.94, opacity)))
  root.style.setProperty('--glass-frost-soft-alpha', cssNumber(mix(0.5, 0.84, opacity)))
  root.style.setProperty('--glass-frost-control-alpha', cssNumber(mix(0.44, 0.76, opacity)))
  root.style.setProperty('--glass-lens-strong', cssNumber(mix(0.9, 1, opacity)))
  root.style.setProperty('--glass-lens-panel', cssNumber(mix(0.78, 0.98, opacity)))
  root.style.setProperty('--glass-lens-soft', cssNumber(mix(0.68, 0.96, opacity)))
  root.style.setProperty('--glass-lens-control', cssNumber(mix(0.58, 0.93, opacity)))
  root.style.setProperty('--glass-window-blur', `${blur.toFixed(1)}px`)
  root.style.setProperty('--glass-ambient-opacity', ambientOpacity.toFixed(3))
}

interface AppearanceStore {
  settings: AppearanceSettings
  updateSetting: <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => void
  reset: () => void
}

export const useAppearanceStore = create<AppearanceStore>((set) => {
  const initial = readSettings()
  applyAppearanceSettings(initial)

  return {
    settings: initial,
    updateSetting: (key, value) =>
      set((state) => {
        const settings = normalizeSettings({ ...state.settings, [key]: value })
        saveSettings(settings)
        applyAppearanceSettings(settings)
        return { settings }
      }),
    reset: () => {
      saveSettings(DEFAULT_APPEARANCE_SETTINGS)
      applyAppearanceSettings(DEFAULT_APPEARANCE_SETTINGS)
      set({ settings: DEFAULT_APPEARANCE_SETTINGS })
    }
  }
})

export function useApplyAppearanceSettings(): void {
  const settings = useAppearanceStore((state) => state.settings)

  useEffect(() => {
    applyAppearanceSettings(settings)
  }, [settings.motionSpeed, settings.glassOpacity, settings.frost])
}
