import type { SessionSet } from '../types'

/**
 * Check if progression is triggered: the last two working sets both reached max reps.
 */
export function checkProgressionTrigger(
  sets: SessionSet[],
  maxReps: number
): { triggered: boolean; lastTwoSets: SessionSet[] } {
  const workingSets = sets
    .filter(s => s.setType === 'working' && s.completed)
    .sort((a, b) => a.setIndex - b.setIndex)

  if (workingSets.length < 2) {
    return { triggered: false, lastTwoSets: workingSets }
  }

  const lastTwo = workingSets.slice(-2)
  const triggered = lastTwo.every(s => s.reps >= maxReps)

  return { triggered, lastTwoSets: lastTwo }
}

export interface ProgressionOption {
  label: string
  increment: number
}

/**
 * Get available progression increment options based on the exercise type.
 */
export function getProgressionOptions(): ProgressionOption[] {
  return [
    { label: '+2.5 kg', increment: 2.5 },
    { label: '+5 kg', increment: 5 },
  ]
}

/**
 * Calculate suggested weight for next session.
 */
export function getSuggestedWeight(
  lastWeight: number,
  increment?: number
): number {
  if (increment) {
    return Math.round((lastWeight + increment) * 2) / 2
  }
  return lastWeight
}

/**
 * Calculate the volume (weight × reps) for a set.
 */
export function calculateSetVolume(set: SessionSet): number {
  return set.weight * set.reps
}

/**
 * Calculate total volume for an exercise (all working sets).
 */
export function calculateExerciseVolume(sets: SessionSet[]): number {
  return sets
    .filter(s => s.setType === 'working')
    .reduce((total, s) => total + calculateSetVolume(s), 0)
}

/**
 * Calculate total volume for a session (all working sets across all exercises).
 */
export function calculateSessionVolume(allSets: SessionSet[][]): number {
  return allSets.reduce(
    (total, exerciseSets) => total + calculateExerciseVolume(exerciseSets),
    0
  )
}

/**
 * Calculate the number of working sets completed.
 */
export function countWorkingSets(sets: SessionSet[]): number {
  return sets.filter(s => s.setType === 'working' && s.completed).length
}

/**
 * Check for stagnation: 3 consecutive sessions with no volume increase and no weight increase.
 */
export function checkStagnation(
  recentVolumes: number[],
  recentMaxWeights: number[]
): boolean {
  if (recentVolumes.length < 3) return false

  const lastThreeVolumes = recentVolumes.slice(-3)
  const lastThreeWeights = recentMaxWeights.slice(-3)

  // Check if volume hasn't increased in the last 3 sessions
  const volumeStagnant = lastThreeVolumes.every(
    v => v <= lastThreeVolumes[0]
  )
  // Check if max weight hasn't increased
  const weightStagnant = lastThreeWeights.every(
    w => w <= lastThreeWeights[0]
  )

  return volumeStagnant && weightStagnant
}

/**
 * Get last working weight for an exercise from previous session sets.
 */
export function getLastWorkingWeight(sets: SessionSet[]): number | null {
  const workingSets = sets.filter(s => s.setType === 'working' && s.completed)
  if (workingSets.length === 0) return null
  // Return the weight from the first working set (usually representative)
  return workingSets[0].weight
}

/**
 * Get the best set (highest weight × reps) from a list of sets.
 */
export function getBestSet(sets: SessionSet[]): SessionSet | null {
  const workingSets = sets.filter(s => s.setType === 'working' && s.completed)
  if (workingSets.length === 0) return null
  return workingSets.reduce((best, current) =>
    calculateSetVolume(current) > calculateSetVolume(best) ? current : best
  )
}

/**
 * Get max weight from a list of sets.
 */
export function getMaxWeight(sets: SessionSet[]): number | null {
  const workingSets = sets.filter(s => s.setType === 'working' && s.completed)
  if (workingSets.length === 0) return null
  return Math.max(...workingSets.map(s => s.weight))
}
