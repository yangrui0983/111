import { supabase, isSupabaseConfigured } from './client'
import { db } from '../db/database'
import type { WorkoutSession, SessionExercise, SessionSet, SyncStatus } from '../types'
import { nowISO } from '../lib/volume'

export interface SyncResult {
  sessionsSynced: number
  errors: string[]
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function uploadSession(session: WorkoutSession): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const userId = await getCurrentUserId()
  if (!userId) return false

  try {
    // Upload session — program_id may be 'default' (not a UUID), so pass null
    const { error: se } = await supabase.from('workout_sessions').upsert({
      id: session.id,
      user_id: userId,
      program_id: null, // local 'default' is not a valid UUID; let DB handle
      workout_template_id: session.workoutTemplateId,
      started_at: session.startedAt,
      completed_at: session.completedAt,
      duration_seconds: session.durationSeconds,
      total_volume: session.totalVolume,
      total_work_sets: session.totalWorkSets,
      cycle_week: session.cycleWeek,
      is_deload: session.isDeload,
      is_complete: session.isComplete,
      updated_at: nowISO(),
    }, { onConflict: 'id' })
    if (se) { console.error('Upload session error:', se); throw se }

    const exercises = await db.sessionExercises.where('workoutSessionId').equals(session.id).toArray()
    for (const ex of exercises) {
      const { error: exErr } = await supabase.from('session_exercises').upsert({
        id: ex.id,
        workout_session_id: ex.workoutSessionId,
        exercise_id: ex.exerciseId,
        name_snapshot: ex.nameSnapshot,
        muscle_group_snapshot: ex.muscleGroupSnapshot,
        order_index: ex.orderIndex,
        target_sets: ex.targetSets,
        was_replaced: ex.wasReplaced,
      }, { onConflict: 'id' })
      if (exErr) { console.error('Upload exercise error:', exErr); throw exErr }

      const sets = await db.sessionSets.where('sessionExerciseId').equals(ex.id).toArray()
      for (const set of sets) {
        const { error: setErr } = await supabase.from('session_sets').upsert({
          id: set.id,
          session_exercise_id: set.sessionExerciseId,
          set_index: set.setIndex,
          set_type: set.setType,
          weight: set.weight,
          reps: set.reps,
          completed: set.completed,
          rpe: set.rpe,
          rest_seconds_planned: set.restSecondsPlanned,
          rest_seconds_actual: set.restSecondsActual,
          started_at: set.startedAt,
          completed_at: set.completedAt,
          notes: set.notes,
        }, { onConflict: 'id' })
        if (setErr) { console.error('Upload set error:', setErr); throw setErr }
      }
    }

    await db.workoutSessions.update(session.id, { syncStatus: 'synced' as SyncStatus, updatedAt: nowISO() })
    return true
  } catch (error) {
    console.error('Upload failed:', error)
    await db.workoutSessions.update(session.id, { syncStatus: 'error' as SyncStatus })
    return false
  }
}

export async function downloadSessions(): Promise<SyncResult> {
  const result: SyncResult = { sessionsSynced: 0, errors: [] }
  if (!isSupabaseConfigured()) return result
  const userId = await getCurrentUserId()
  if (!userId) return result

  try {
    const { data: cs, error } = await supabase.from('workout_sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false })
    if (error) throw error
    if (!cs) return result

    for (const cloudS of cs) {
      const local = await db.workoutSessions.get(cloudS.id)
      if (local) {
        if (new Date(local.updatedAt).getTime() >= new Date(cloudS.updated_at).getTime()) continue
      }

      await db.workoutSessions.put({
        id: cloudS.id,
        programId: cloudS.program_id || 'default',
        workoutTemplateId: cloudS.workout_template_id || '',
        startedAt: cloudS.started_at,
        completedAt: cloudS.completed_at,
        durationSeconds: cloudS.duration_seconds,
        totalVolume: cloudS.total_volume,
        totalWorkSets: cloudS.total_work_sets,
        cycleWeek: cloudS.cycle_week,
        isDeload: cloudS.is_deload,
        isComplete: cloudS.is_complete,
        createdAt: cloudS.created_at,
        updatedAt: cloudS.updated_at,
        syncStatus: 'synced' as SyncStatus,
      })

      const { data: cex } = await supabase.from('session_exercises').select('*').eq('workout_session_id', cloudS.id)
      if (cex) {
        for (const ce of cex) {
          await db.sessionExercises.put({
            id: ce.id,
            workoutSessionId: ce.workout_session_id,
            exerciseId: ce.exercise_id,
            nameSnapshot: ce.name_snapshot,
            muscleGroupSnapshot: ce.muscle_group_snapshot,
            orderIndex: ce.order_index,
            targetSets: ce.target_sets,
            wasReplaced: ce.was_replaced,
          })
          const { data: csets } = await supabase.from('session_sets').select('*').eq('session_exercise_id', ce.id)
          if (csets) {
            for (const cs of csets) {
              await db.sessionSets.put({
                id: cs.id,
                sessionExerciseId: cs.session_exercise_id,
                setIndex: cs.set_index,
                setType: cs.set_type,
                weight: cs.weight,
                reps: cs.reps,
                completed: cs.completed,
                rpe: cs.rpe,
                restSecondsPlanned: cs.rest_seconds_planned,
                restSecondsActual: cs.rest_seconds_actual,
                startedAt: cs.started_at,
                completedAt: cs.completed_at,
                notes: cs.notes,
              })
            }
          }
        }
      }
      result.sessionsSynced++
    }
  } catch (error) {
    result.errors.push(String(error))
  }
  return result
}

export async function syncLocalToCloud(): Promise<SyncResult> {
  const result: SyncResult = { sessionsSynced: 0, errors: [] }
  if (!isSupabaseConfigured()) return result
  const pending = await db.workoutSessions.where('syncStatus').equals('pending' as SyncStatus).toArray()
  for (const session of pending) {
    const ok = await uploadSession(session)
    if (ok) result.sessionsSynced++
    else result.errors.push(`同步失败: ${session.id}`)
  }
  return result
}

export async function fullSync(): Promise<SyncResult> {
  const push = await syncLocalToCloud()
  const pull = await downloadSessions()
  return {
    sessionsSynced: push.sessionsSynced + pull.sessionsSynced,
    errors: [...push.errors, ...pull.errors],
  }
}
