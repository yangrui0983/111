import { describe, it, expect } from 'vitest'
import {
  calculateDuration,
  formatDuration,
  formatTimer,
  formatWeight,
  formatDate,
} from '../lib/volume'

describe('calculateDuration', () => {
  it('should calculate duration in seconds between two timestamps', () => {
    const start = '2025-01-01T00:00:00Z'
    const end = '2025-01-01T01:00:00Z'
    expect(calculateDuration(start, end)).toBe(3600)
  })

  it('should return 0 for equal timestamps', () => {
    const t = '2025-01-01T00:00:00Z'
    expect(calculateDuration(t, t)).toBe(0)
  })
})

describe('formatDuration', () => {
  it('should format seconds only', () => {
    expect(formatDuration(45)).toBe('45秒')
  })

  it('should format minutes and seconds', () => {
    expect(formatDuration(65)).toBe('1分5秒')
    expect(formatDuration(125)).toBe('2分5秒')
  })

  it('should format hours and minutes', () => {
    expect(formatDuration(3660)).toBe('1小时1分')
    expect(formatDuration(7200)).toBe('2小时0分')
  })
})

describe('formatTimer', () => {
  it('should format seconds as MM:SS', () => {
    expect(formatTimer(0)).toBe('00:00')
    expect(formatTimer(5)).toBe('00:05')
    expect(formatTimer(60)).toBe('01:00')
    expect(formatTimer(90)).toBe('01:30')
    expect(formatTimer(3599)).toBe('59:59')
  })
})

describe('formatWeight', () => {
  it('should format integer weights without decimals', () => {
    expect(formatWeight(50)).toBe('50')
    expect(formatWeight(100)).toBe('100')
  })

  it('should format decimal weights with one decimal', () => {
    expect(formatWeight(50.5)).toBe('50.5')
    expect(formatWeight(2.5)).toBe('2.5')
  })
})

describe('formatDate', () => {
  it('should format date in Chinese format', () => {
    const result = formatDate('2025-06-15T00:00:00Z')
    expect(result).toContain('6月15日')
    expect(result).toContain('周日')
  })
})
