import type { SessionSet } from '../types'

/**
 * Calculate the duration between two ISO timestamps in seconds.
 */
export function calculateDuration(startedAt: string, completedAt: string): number {
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  return Math.max(0, Math.floor((end - start) / 1000))
}

/**
 * Format seconds into a human-readable string (e.g., "65分30秒" or "1小时5分").
 */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}秒`
  }
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return seconds > 0
      ? `${hours}小时${minutes}分`
      : `${hours}小时${minutes}分`
  }
  return seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes}分钟`
}

/**
 * Format a duration for display in rest timer (MM:SS).
 */
export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/**
 * Format weight for display.
 */
export function formatWeight(weight: number): string {
  return weight % 1 === 0 ? weight.toString() : weight.toFixed(1)
}

/**
 * Format date for display in Chinese.
 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const weekday = weekdays[d.getDay()]
  return `${month}月${day}日 周${weekday}`
}

/**
 * Format full date with year.
 */
export function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/**
 * Get today's date in YYYY-MM-DD format.
 */
export function getTodayDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Get the current date and time as ISO string.
 */
export function nowISO(): string {
  return new Date().toISOString()
}

/**
 * Generate a simple UUID v4.
 */
export function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
}
