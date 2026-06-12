import { describe, it, expect } from 'vitest'
import {
  checkProgressionTrigger,
  getProgressionOptions,
  calculateSetVolume,
  calculateExerciseVolume,
  calculateSessionVolume,
  countWorkingSets,
  checkStagnation,
  getLastWorkingWeight,
  getBestSet,
  getMaxWeight,
} from '../lib/progression'
import type { SessionSet } from '../types'

function makeSet(overrides: Partial<SessionSet> = {}): SessionSet {
  return {
    id: 'test-set',
    sessionExerciseId: 'test-ex',
    setIndex: 0,
    setType: 'working',
    weight: 50,
    reps: 10,
    completed: true,
    ...overrides,
  }
}

describe('checkProgressionTrigger', () => {
  it('should trigger when last two working sets reach max reps', () => {
    const sets = [
      makeSet({ setIndex: 0, reps: 12, setType: 'working', completed: true }),
      makeSet({ setIndex: 1, reps: 12, setType: 'working', completed: true }),
    ]
    const result = checkProgressionTrigger(sets, 12)
    expect(result.triggered).toBe(true)
    expect(result.lastTwoSets).toHaveLength(2)
  })

  it('should not trigger when sets do not reach max reps', () => {
    const sets = [
      makeSet({ setIndex: 0, reps: 10, setType: 'working', completed: true }),
      makeSet({ setIndex: 1, reps: 11, setType: 'working', completed: true }),
    ]
    const result = checkProgressionTrigger(sets, 12)
    expect(result.triggered).toBe(false)
  })

  it('should not trigger with less than 2 sets', () => {
    const sets = [
      makeSet({ setIndex: 0, reps: 12, setType: 'working', completed: true }),
    ]
    const result = checkProgressionTrigger(sets, 12)
    expect(result.triggered).toBe(false)
  })

  it('should only consider completed working sets', () => {
    const sets = [
      makeSet({ setIndex: 0, reps: 12, setType: 'working', completed: true }),
      makeSet({ setIndex: 1, reps: 12, setType: 'working', completed: false }),
    ]
    const result = checkProgressionTrigger(sets, 12)
    expect(result.triggered).toBe(false)
  })

  it('should check the last two completed sets', () => {
    const sets = [
      makeSet({ setIndex: 0, reps: 10, setType: 'working', completed: true }),
      makeSet({ setIndex: 1, reps: 12, setType: 'working', completed: true }),
      makeSet({ setIndex: 2, reps: 12, setType: 'working', completed: true }),
    ]
    const result = checkProgressionTrigger(sets, 12)
    expect(result.triggered).toBe(true)
    expect(result.lastTwoSets[0].reps).toBe(12)
    expect(result.lastTwoSets[1].reps).toBe(12)
  })
})

describe('getProgressionOptions', () => {
  it('should return 2.5kg and 5kg options', () => {
    const options = getProgressionOptions()
    expect(options).toHaveLength(2)
    expect(options[0].increment).toBe(2.5)
    expect(options[1].increment).toBe(5)
  })
})

describe('calculateSetVolume', () => {
  it('should calculate weight × reps', () => {
    expect(calculateSetVolume(makeSet({ weight: 50, reps: 10 }))).toBe(500)
    expect(calculateSetVolume(makeSet({ weight: 100, reps: 5 }))).toBe(500)
    expect(calculateSetVolume(makeSet({ weight: 20, reps: 15 }))).toBe(300)
  })
})

describe('calculateExerciseVolume', () => {
  it('should sum all working set volumes', () => {
    const sets = [
      makeSet({ setIndex: 0, weight: 50, reps: 10, setType: 'working' }),
      makeSet({ setIndex: 1, weight: 50, reps: 8, setType: 'working' }),
      makeSet({ setIndex: 2, weight: 40, reps: 12, setType: 'warmup' }),
    ]
    expect(calculateExerciseVolume(sets)).toBe(500 + 400)
  })

  it('should return 0 for no working sets', () => {
    expect(calculateExerciseVolume([])).toBe(0)
  })
})

describe('calculateSessionVolume', () => {
  it('should sum volumes across all exercises', () => {
    const exercise1 = [
      makeSet({ setIndex: 0, weight: 50, reps: 10, setType: 'working' }),
    ]
    const exercise2 = [
      makeSet({ setIndex: 0, weight: 30, reps: 12, setType: 'working' }),
    ]
    expect(calculateSessionVolume([exercise1, exercise2])).toBe(500 + 360)
  })
})

describe('countWorkingSets', () => {
  it('should count completed working sets', () => {
    const sets = [
      makeSet({ setIndex: 0, setType: 'warmup', completed: true }),
      makeSet({ setIndex: 1, setType: 'working', completed: true }),
      makeSet({ setIndex: 2, setType: 'working', completed: true }),
      makeSet({ setIndex: 3, setType: 'working', completed: false }),
    ]
    expect(countWorkingSets(sets)).toBe(2)
  })
})

describe('checkStagnation', () => {
  it('should detect stagnation when volume and weight stay same', () => {
    const volumes = [1000, 1000, 1000]
    const weights = [50, 50, 50]
    expect(checkStagnation(volumes, weights)).toBe(true)
  })

  it('should not flag stagnation with increasing volumes', () => {
    const volumes = [1000, 1050, 1100]
    const weights = [50, 50, 50]
    expect(checkStagnation(volumes, weights)).toBe(false)
  })

  it('should not flag with less than 3 sessions', () => {
    expect(checkStagnation([1000, 1050], [50, 50])).toBe(false)
    expect(checkStagnation([1000], [50])).toBe(false)
    expect(checkStagnation([], [])).toBe(false)
  })

  it('should not flag stagnation when weight increases even if volume is flat', () => {
    const volumes = [1000, 1000, 1000]
    const weights = [50, 50, 55]
    // Weight increased, so not stagnant — progression is happening
    expect(checkStagnation(volumes, weights)).toBe(false)
  })
})

describe('getLastWorkingWeight', () => {
  it('should return first working set weight', () => {
    const sets = [
      makeSet({ setIndex: 0, weight: 40, setType: 'warmup', completed: true }),
      makeSet({ setIndex: 1, weight: 60, setType: 'working', completed: true }),
    ]
    expect(getLastWorkingWeight(sets)).toBe(60)
  })

  it('should return null if no working sets', () => {
    expect(getLastWorkingWeight([])).toBe(null)
  })
})

describe('getBestSet', () => {
  it('should return set with highest volume', () => {
    const sets = [
      makeSet({ setIndex: 0, weight: 50, reps: 10 }),
      makeSet({ setIndex: 1, weight: 60, reps: 8 }),
      makeSet({ setIndex: 2, weight: 40, reps: 12 }),
    ]
    const best = getBestSet(sets)
    expect(best?.weight).toBe(50)
    expect(best?.reps).toBe(10)
  })

  it('should return null for empty sets', () => {
    expect(getBestSet([])).toBe(null)
  })
})

describe('getMaxWeight', () => {
  it('should return max weight from completed working sets', () => {
    const sets = [
      makeSet({ setIndex: 0, weight: 50, reps: 10 }),
      makeSet({ setIndex: 1, weight: 60, reps: 8 }),
      makeSet({ setIndex: 2, weight: 55, reps: 12 }),
    ]
    expect(getMaxWeight(sets)).toBe(60)
  })

  it('should return null for empty sets', () => {
    expect(getMaxWeight([])).toBe(null)
  })
})
