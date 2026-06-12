import { WORKOUT_ORDER } from '../db/seedData'

/**
 * Calculate the current cycle week based on the start date and completed sessions.
 * The cycle starts at week 1 on the start date.
 * Each completed workout session counts as step forward in the cycle.
 * The cycle itself (weeks 1-8) is based on calendar weeks from start date.
 */
export function getCycleWeek(startDate: string, referenceDate: string = new Date().toISOString()): number {
  const start = new Date(startDate)
  const ref = new Date(referenceDate)
  const diffMs = ref.getTime() - start.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const weekNumber = Math.floor(diffDays / 7) + 1
  // Cycle is 8 weeks, then resets
  const cycleWeek = ((weekNumber - 1) % 8) + 1
  return cycleWeek
}

/**
 * Determine if the current cycle week is a deload week (week 8).
 */
export function isDeloadWeek(cycleWeek: number): boolean {
  return cycleWeek === 8
}

/**
 * Get deload-adjusted weight: reduce by 40%.
 */
export function getDeloadWeight(originalWeight: number): number {
  return Math.round(originalWeight * 0.6 * 2) / 2 // Round to nearest 0.5
}

/**
 * Get deload-adjusted sets: halve and round up.
 */
export function getDeloadSets(originalSets: number): number {
  return Math.ceil(originalSets / 2)
}

/**
 * Calculate the next workout template ID based on the last completed workout.
 * Returns the next in the rotation sequence.
 */
export function getNextWorkout(lastCompletedTemplateId: string | null): string {
  if (!lastCompletedTemplateId) {
    return WORKOUT_ORDER[0] // Start with push-a
  }
  const index = WORKOUT_ORDER.indexOf(lastCompletedTemplateId)
  if (index === -1) {
    return WORKOUT_ORDER[0]
  }
  const nextIndex = (index + 1) % WORKOUT_ORDER.length
  return WORKOUT_ORDER[nextIndex]
}

export function getWorkoutName(templateId: string): string {
  const names: Record<string, string> = {
    'push-a': '推日A',
    'pull-a': '拉日A',
    'legs': '腿日',
    'compound': '综合复合日',
  }
  return names[templateId] || templateId
}

export function getNextWorkoutName(lastCompletedTemplateId: string | null): string {
  return getWorkoutName(getNextWorkout(lastCompletedTemplateId))
}

/**
 * Get cycle events that should be shown for a given cycle week.
 */
export function getCycleEventsForWeek(cycleWeek: number): Array<{
  type: string
  title: string
  message: string
}> {
  const events: Array<{ type: string; title: string; message: string }> = []

  if (cycleWeek === 5) {
    events.push({
      type: 'week5_action_swap',
      title: '动作替换建议',
      message: '你已经进入第5周，建议替换 2-3 个同类动作，打破肌肉适应。',
    })
  }

  if (cycleWeek === 6) {
    events.push({
      type: 'week6_new_cycle',
      title: '新周期建议',
      message: '进入第6周，建议全面调整动作顺序、角度或动作选择，给肌肉新刺激。',
    })
  }

  if (cycleWeek === 8) {
    events.push({
      type: 'week8_deload',
      title: '减载周',
      message: '本周为减载周，重量自动降低 40%，组数减半。',
    })
  }

  return events
}

/**
 * Check if a cycle event should be shown.
 * Returns true if the event hasn't been dismissed or snoozed past now.
 */
export function shouldShowCycleEvent(
  cycleWeek: number,
  eventType: string,
  existingEvents: Array<{ cycleWeek: number; eventType: string; dismissedAt?: string; snoozedUntil?: string }>
): boolean {
  // Check if there's a matching event record
  const record = existingEvents.find(
    e => e.cycleWeek === cycleWeek && e.eventType === eventType
  )

  if (!record) return true // Never seen before
  if (record.dismissedAt) return false // Dismissed permanently

  // Check snooze
  if (record.snoozedUntil) {
    const snoozedUntil = new Date(record.snoozedUntil)
    if (snoozedUntil > new Date()) {
      return false // Still snoozed
    }
  }

  return true // Past snooze or no snooze
}
