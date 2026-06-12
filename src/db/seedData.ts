import type { WorkoutTemplate } from '../types'

export const DEFAULT_PROGRAM = {
  name: 'PPL 增肌计划',
  goal: '增肌',
}

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  { id: 'push-a', programId: 'default', name: '推日A', sequenceOrder: 1, estimatedDurationMin: 65 },
  { id: 'pull-a', programId: 'default', name: '拉日A', sequenceOrder: 2, estimatedDurationMin: 65 },
  { id: 'legs', programId: 'default', name: '腿日', sequenceOrder: 3, estimatedDurationMin: 70 },
  { id: 'compound', programId: 'default', name: '综合复合日', sequenceOrder: 4, estimatedDurationMin: 50 },
]

export const WORKOUT_ORDER = ['push-a', 'pull-a', 'legs', 'compound']

export const WORKOUT_TEMPLATE_NAMES: Record<string, string> = {
  'push-a': '推日A',
  'pull-a': '拉日A',
  'legs': '腿日',
  'compound': '综合复合日',
}
