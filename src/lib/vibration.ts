/**
 * Vibrate the device if the Vibration API is available.
 * Falls back gracefully if not supported.
 */
export function vibrate(pattern: number | number[] = 200): boolean {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      return navigator.vibrate(pattern)
    } catch {
      return false
    }
  }
  return false
}

/**
 * Play a notification sound using the Web Audio API.
 * This works in iOS Safari even without user interaction in some cases.
 */
export function playNotificationSound(): void {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime)
    oscillator.frequency.setValueAtTime(660, audioCtx.currentTime + 0.15)
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.3)

    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5)

    oscillator.start(audioCtx.currentTime)
    oscillator.stop(audioCtx.currentTime + 0.5)
  } catch {
    // Audio not available, silently fall back
  }
}

/**
 * Check if vibration is supported.
 */
export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}

/**
 * Check if the app is running in standalone mode (iOS PWA).
 */
export function isStandalonePWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
}
