// ============ Core Domain Types ============

export type SetType = 'warmup' | 'working'
export type MovementPattern = 'push' | 'pull' | 'legs' | 'arms' | 'shoulders' | 'chest' | 'back' | 'glutes_hams' | 'calves' | 'core'
export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'smith_machine' | 'ez_bar' | 'kettlebell' | 'band' | 'other'
export type CycleEventType = 'week5_action_swap' | 'week6_new_cycle' | 'week8_deload'
export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'error'
export type TabName = 'today' | 'history' | 'trends' | 'settings'

export interface Program {
  id: string
  userId?: string
  name: string
  goal: string
  cycleStartDate: string
  currentCycleWeek: number
  createdAt: string
  updatedAt: string
  syncStatus?: SyncStatus
}

export interface WorkoutTemplate {
  id: string
  programId: string
  name: string
  sequenceOrder: number
  estimatedDurationMin: number
  notes?: string
}

// === Exercise Library (global, independent of templates) ===
export interface ExerciseLibraryItem {
  id: string
  userId?: string
  name: string
  muscleGroup: string
  movementPattern: MovementPattern
  equipment: Equipment
  isCustom: boolean
  createdAt: string
  updatedAt: string
}

// === Bridge: links a workout template to an exercise library item ===
export interface WorkoutTemplateExercise {
  id: string
  workoutTemplateId: string
  exerciseId: string
  displayName: string
  orderIndex: number
  targetSets: number
  minReps: number
  maxReps: number
  restSecondsMin: number
  restSecondsMax: number
  warmupSets: number
  warmupPercent: number
  isEachSide: boolean
  notes?: string
}

// Kept for backward compatibility — maps template exercise ID to library exercise ID
// Used during migration from old schema
export interface ExerciseTemplate {
  id: string
  workoutTemplateId: string
  name: string
  muscleGroup: string
  orderIndex: number
  targetSets: number
  minReps: number
  maxReps: number
  restSecondsMin: number
  restSecondsMax: number
  warmupSets: number
  warmupPercent: number
  isEachSide: boolean
  notes?: string
}

export interface WorkoutSession {
  id: string
  userId?: string
  programId: string
  workoutTemplateId: string
  startedAt: string
  completedAt?: string
  durationSeconds?: number
  totalVolume?: number
  totalWorkSets?: number
  cycleWeek: number
  isDeload: boolean
  isComplete: boolean
  createdAt: string
  updatedAt: string
  syncStatus?: SyncStatus
}

export interface SessionExercise {
  id: string
  workoutSessionId: string
  exerciseId: string          // FK to ExerciseLibraryItem
  nameSnapshot: string         // Name at time of recording
  muscleGroupSnapshot: string
  orderIndex: number
  targetSets: number
  wasReplaced: boolean         // true if this was swapped mid-session
  originalTemplateExerciseId?: string
  notes?: string
}

export interface SessionSet {
  id: string
  sessionExerciseId: string
  setIndex: number
  setType: SetType
  weight: number
  reps: number
  completed: boolean
  rpe?: number
  restSecondsPlanned?: number
  restSecondsActual?: number
  startedAt?: string
  completedAt?: string
  notes?: string
}

export interface ProgressionSuggestion {
  id: string
  userId?: string
  exerciseId: string           // FK to ExerciseLibraryItem
  baseWeight: number
  suggestedWeight: number
  increment: number
  reason: string
  accepted: boolean
  createdAt: string
  appliedAt?: string
}

export interface UserSettings {
  id: string
  userId?: string
  reminderEnabled: boolean
  reminderTime?: string
  reminderIntervalDays: number
  vibrationEnabled: boolean
  soundEnabled: boolean
  weightUnit: 'kg' | 'lb'
  createdAt: string
  updatedAt: string
}

export interface CycleEvent {
  id: string
  userId?: string
  programId: string
  cycleWeek: number
  eventType: CycleEventType
  shownAt?: string
  dismissedAt?: string
  snoozedUntil?: string
}

// ============ UI State Types ============

export interface RestTimerState {
  active: boolean
  endTime: number
  totalSeconds: number
  remainingSeconds: number
  setIndex: number
  exerciseId: string
}

export interface WorkoutProgress {
  currentExerciseIndex: number
  currentSetIndex: number
  phase: 'exercising' | 'resting' | 'summary'
}

export interface WorkoutAdjustment {
  type: 'skip' | 'replace' | 'add' | 'adjust_sets'
  persistToPlan: boolean
}

export function movementPatternLabel(p: MovementPattern): string {
  const map: Record<MovementPattern, string> = {
    push: '推', pull: '拉', legs: '腿', arms: '手臂',
    shoulders: '肩', chest: '胸', back: '背',
    glutes_hams: '臀腿', calves: '小腿', core: '核心'
  }
  return map[p]
}

export function equipmentLabel(e: Equipment): string {
  const map: Record<Equipment, string> = {
    barbell: '杠铃', dumbbell: '哑铃', cable: '绳索',
    machine: '固定器械', bodyweight: '自重', smith_machine: '史密斯机',
    ez_bar: 'EZ杠', kettlebell: '壶铃', band: '弹力带', other: '其他'
  }
  return map[e]
}
