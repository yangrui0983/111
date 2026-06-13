import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getCycleWeek,
  isDeloadWeek,
  getDeloadWeight,
  getDeloadSets,
  getNextWorkout,
  getWorkoutName,
  getCycleEventsForWeek,
} from '../lib/cycle'

// Variable to control mock count per test
let mockCount = 0

// Mock Dexie db
vi.mock('../db/database', () => ({
  db: {
    workoutSessions: {
      filter: () => ({
        count: async () => mockCount
      })
    }
  }
}))

describe('getCycleWeek', () => {
  beforeEach(() => { mockCount = 0 })

  it('should return week 1 with 0 completed sessions', async () => {
    mockCount = 0
    const result = await getCycleWeek()
    expect(result).toBe(1)
  })

  it('should return week 2 after 4 completed sessions', async () => {
    mockCount = 4
    const result = await getCycleWeek()
    expect(result).toBe(2)
  })

  it('should return week 5 after 16 completed sessions', async () => {
    mockCount = 16
    const result = await getCycleWeek()
    expect(result).toBe(5)
  })

  it('should return week 8 after 28 completed sessions', async () => {
    mockCount = 28
    const result = await getCycleWeek()
    expect(result).toBe(8)
  })

  it('should wrap back to week 1 after 32 completed sessions', async () => {
    mockCount = 32
    const result = await getCycleWeek()
    expect(result).toBe(1)
  })

  it('should return week 2 after 36 completed sessions', async () => {
    mockCount = 36
    const result = await getCycleWeek()
    expect(result).toBe(2)
  })
})

describe('isDeloadWeek', () => {
  it('should return true for week 8', () => {
    expect(isDeloadWeek(8)).toBe(true)
  })

  it('should return false for week 1', () => {
    expect(isDeloadWeek(1)).toBe(false)
  })

  it('should return false for week 5', () => {
    expect(isDeloadWeek(5)).toBe(false)
  })

  it('should return false for week 7', () => {
    expect(isDeloadWeek(7)).toBe(false)
  })
})

describe('getDeloadWeight', () => {
  it('should reduce weight by 40% and round to nearest 0.5', () => {
    expect(getDeloadWeight(100)).toBe(60)
    expect(getDeloadWeight(60)).toBe(36)
    expect(getDeloadWeight(42.5)).toBe(25.5)
    expect(getDeloadWeight(50)).toBe(30)
  })

  it('should handle small weights', () => {
    expect(getDeloadWeight(10)).toBe(6)
  })
})

describe('getDeloadSets', () => {
  it('should halve and round up even numbers', () => {
    expect(getDeloadSets(4)).toBe(2)
    expect(getDeloadSets(2)).toBe(1)
    expect(getDeloadSets(6)).toBe(3)
  })

  it('should halve and round up odd numbers', () => {
    expect(getDeloadSets(3)).toBe(2)
    expect(getDeloadSets(1)).toBe(1)
    expect(getDeloadSets(5)).toBe(3)
  })
})

describe('getNextWorkout', () => {
  it('should start with push-a when no previous workout', () => {
    expect(getNextWorkout(null)).toBe('push-a')
  })

  it('should go from push-a to pull-a', () => {
    expect(getNextWorkout('push-a')).toBe('pull-a')
  })

  it('should go from pull-a to legs', () => {
    expect(getNextWorkout('pull-a')).toBe('legs')
  })

  it('should go from legs to compound', () => {
    expect(getNextWorkout('legs')).toBe('compound')
  })

  it('should cycle back from compound to push-a', () => {
    expect(getNextWorkout('compound')).toBe('push-a')
  })

  it('should return push-a for unknown template', () => {
    expect(getNextWorkout('unknown')).toBe('push-a')
  })
})

describe('getWorkoutName', () => {
  it('should return correct Chinese name', () => {
    expect(getWorkoutName('push-a')).toBe('推日A')
    expect(getWorkoutName('pull-a')).toBe('拉日A')
    expect(getWorkoutName('legs')).toBe('腿日')
    expect(getWorkoutName('compound')).toBe('综合复合日')
  })

  it('should return templateId for unknown template', () => {
    expect(getWorkoutName('unknown')).toBe('unknown')
  })
})

describe('getCycleEventsForWeek', () => {
  it('should return week 5 action swap event', () => {
    const events = getCycleEventsForWeek(5)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('week5_action_swap')
    expect(events[0].title).toBe('动作替换建议')
  })

  it('should return week 6 new cycle event', () => {
    const events = getCycleEventsForWeek(6)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('week6_new_cycle')
    expect(events[0].title).toBe('新周期建议')
  })

  it('should return week 8 deload event', () => {
    const events = getCycleEventsForWeek(8)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('week8_deload')
    expect(events[0].title).toBe('减载周')
  })

  it('should return empty for non-event weeks', () => {
    expect(getCycleEventsForWeek(1)).toHaveLength(0)
    expect(getCycleEventsForWeek(2)).toHaveLength(0)
    expect(getCycleEventsForWeek(3)).toHaveLength(0)
    expect(getCycleEventsForWeek(7)).toHaveLength(0)
  })

  it('should handle multiple cycles (week 13 = week 5)', () => {
    const events = getCycleEventsForWeek(5)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('week5_action_swap')
  })
})
