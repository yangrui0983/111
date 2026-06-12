import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { db } from '../db/database'
import { DEFAULT_PROGRAM, WORKOUT_TEMPLATES } from '../db/seedData'
import { EXERCISE_LIBRARY, WORKOUT_TEMPLATE_EXERCISES } from '../db/exerciseLibrary'
import { getCycleWeek, isDeloadWeek } from '../lib/cycle'
import { fullSync } from '../supabase/sync'
import { useAuth } from './useAuth'
import type { Program, UserSettings, WorkoutSession, SyncStatus } from '../types'
import { nowISO, generateId } from '../lib/volume'

interface AppState {
  program: Program | null
  settings: UserSettings | null
  syncStatus: SyncStatus
  cycleWeek: number
  isDeload: boolean
  loading: boolean
  initProgram: () => Promise<void>
  refreshSyncStatus: () => Promise<void>
  runSync: () => Promise<void>
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>
}

const AppStateContext = createContext<AppState>({} as AppState)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [program, setProgram] = useState<Program | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [user])

  async function loadData() {
    try {
      // Load or create program
      let prog = await db.programs.get('default')
      if (!prog) {
        prog = {
          id: 'default',
          name: DEFAULT_PROGRAM.name,
          goal: DEFAULT_PROGRAM.goal,
          cycleStartDate: nowISO(),
          currentCycleWeek: 1,
          createdAt: nowISO(),
          updatedAt: nowISO(),
          syncStatus: 'synced',
        }
        await db.programs.put(prog)

        // Seed workout templates
        for (const wt of WORKOUT_TEMPLATES) {
          await db.workoutTemplates.put(wt)
        }

        // Seed exercise library (fill timestamps)
        const now = nowISO()
        for (const ex of EXERCISE_LIBRARY) {
          await db.exerciseLibrary.put({ ...ex, createdAt: now, updatedAt: now })
        }

        // Seed template-exercise bridge
        for (const wte of WORKOUT_TEMPLATE_EXERCISES) {
          await db.workoutTemplateExercises.put(wte)
        }
      }
      setProgram(prog)

      // Load settings
      let s = await db.userSettings.get('default')
      if (!s) {
        s = {
          id: 'default',
          reminderEnabled: false,
          reminderTime: '19:30',
          reminderIntervalDays: 1,
          vibrationEnabled: true,
          soundEnabled: true,
          weightUnit: 'kg',
          createdAt: nowISO(),
          updatedAt: nowISO(),
        }
        await db.userSettings.put(s)
      }
      setSettings(s)

      // Check sync status
      const pending = await db.workoutSessions
        .where('syncStatus')
        .equals('pending' as SyncStatus)
        .count()
      setSyncStatus(pending > 0 ? 'pending' : 'synced')
    } catch (err) {
      console.error('Load data error:', err)
    } finally {
      setLoading(false)
    }
  }

  const cycleWeek = program ? getCycleWeek(program.cycleStartDate) : 1
  const deload = isDeloadWeek(cycleWeek)

  async function initProgram() {
    if (program) {
      const updated = {
        ...program,
        cycleStartDate: nowISO(),
        currentCycleWeek: 1,
        updatedAt: nowISO(),
      }
      await db.programs.put(updated)
      setProgram(updated)
    }
  }

  async function refreshSyncStatus() {
    const pending = await db.workoutSessions
      .where('syncStatus')
      .equals('pending' as SyncStatus)
      .count()
    setSyncStatus(pending > 0 ? 'pending' : 'synced')
  }

  async function runSync() {
    setSyncStatus('syncing')
    try {
      await fullSync()
      await refreshSyncStatus()
    } catch {
      setSyncStatus('error')
    }
  }

  async function updateSettings(partial: Partial<UserSettings>) {
    if (settings) {
      const updated = { ...settings, ...partial, updatedAt: nowISO() }
      await db.userSettings.put(updated)
      setSettings(updated)
    }
  }

  return (
    <AppStateContext.Provider value={{
      program, settings, syncStatus,
      cycleWeek, isDeload: deload,
      loading, initProgram, refreshSyncStatus, runSync, updateSettings,
    }}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState() {
  return useContext(AppStateContext)
}
