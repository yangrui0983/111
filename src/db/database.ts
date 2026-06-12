import Dexie, { type EntityTable } from 'dexie'
import type {
  Program, WorkoutTemplate,
  WorkoutSession, SessionExercise, SessionSet,
  ProgressionSuggestion, UserSettings, CycleEvent,
  ExerciseLibraryItem, WorkoutTemplateExercise
} from '../types'

export class PPLDatabase extends Dexie {
  programs!: EntityTable<Program, 'id'>
  workoutTemplates!: EntityTable<WorkoutTemplate, 'id'>
  exerciseLibrary!: EntityTable<ExerciseLibraryItem, 'id'>
  workoutTemplateExercises!: EntityTable<WorkoutTemplateExercise, 'id'>
  workoutSessions!: EntityTable<WorkoutSession, 'id'>
  sessionExercises!: EntityTable<SessionExercise, 'id'>
  sessionSets!: EntityTable<SessionSet, 'id'>
  progressionSuggestions!: EntityTable<ProgressionSuggestion, 'id'>
  userSettings!: EntityTable<UserSettings, 'id'>
  cycleEvents!: EntityTable<CycleEvent, 'id'>

  constructor() {
    super('PPLTraining')
    this.version(2).stores({
      programs: 'id, userId',
      workoutTemplates: 'id, programId',
      exerciseLibrary: 'id, userId, muscleGroup, movementPattern',
      workoutTemplateExercises: 'id, workoutTemplateId, exerciseId, orderIndex',
      workoutSessions: 'id, userId, workoutTemplateId, startedAt, syncStatus',
      sessionExercises: 'id, workoutSessionId, exerciseId',
      sessionSets: 'id, sessionExerciseId',
      progressionSuggestions: 'id, userId, exerciseId',
      userSettings: 'id, userId',
      cycleEvents: 'id, userId, programId, cycleWeek, eventType',
    })
  }
}

export const db = new PPLDatabase()
