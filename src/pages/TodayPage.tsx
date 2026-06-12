import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../hooks/useAppState'
import { useAuth } from '../hooks/useAuth'
import { db } from '../db/database'
import { getNextWorkout, getWorkoutName, getCycleEventsForWeek, shouldShowCycleEvent } from '../lib/cycle'
import { formatDate, formatDuration } from '../lib/volume'
import type { WorkoutSession } from '../types'

const ALL_WORKOUTS = ['push-a', 'pull-a', 'legs', 'compound']
const WORKOUT_LABELS: Record<string, string> = { 'push-a': '推日A', 'pull-a': '拉日A', 'legs': '腿日', 'compound': '综合复合日' }

export default function TodayPage() {
  const navigate = useNavigate()
  const { program, cycleWeek, isDeload, syncStatus } = useAppState()
  const { user } = useAuth()
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null)
  const [weekSessionCount, setWeekSessionCount] = useState(0)
  const [cycleEvents, setCycleEvents] = useState<Array<{type: string; title: string; message: string}>>([])
  const [shownEvent, setShownEvent] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('push-a')
  const [showPicker, setShowPicker] = useState(false)

  const displayDate = formatDate(new Date().toISOString())

  useEffect(() => { loadData() }, [program, cycleWeek])

  useEffect(() => {
    const next = lastSession ? getNextWorkout(lastSession.workoutTemplateId) : getNextWorkout(null)
    setSelectedTemplateId(next)
  }, [lastSession])

  async function loadData() {
    const last = await db.workoutSessions.orderBy('startedAt').filter(s => s.isComplete).last()
    setLastSession(last ?? null)

    const startOfWeek = new Date()
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const allSessions = await db.workoutSessions.filter(s => s.isComplete && new Date(s.startedAt) >= startOfWeek).toArray()
    setWeekSessionCount(allSessions.length)

    if (program) {
      const events = getCycleEventsForWeek(cycleWeek)
      setCycleEvents(events)
      const existingEvents = await db.cycleEvents.where({ programId: program.id, cycleWeek }).toArray()
      for (const event of events) {
        if (shouldShowCycleEvent(cycleWeek, event.type,
          existingEvents.map(e => ({ cycleWeek: e.cycleWeek, eventType: e.eventType, dismissedAt: e.dismissedAt, snoozedUntil: e.snoozedUntil }))
        )) { setShownEvent(event.type); break }
      }
    }
  }

  async function handleDismissEvent() {
    if (!shownEvent || !program) return
    const event = cycleEvents.find(e => e.type === shownEvent)
    if (!event) return
    await db.cycleEvents.put({ id: `${program.id}-${cycleWeek}-${event.type}`, programId: program.id, cycleWeek, eventType: event.type as any, dismissedAt: new Date().toISOString() })
    setShownEvent(null)
  }

  async function handleSnoozeEvent() {
    if (!shownEvent || !program) return
    const event = cycleEvents.find(e => e.type === shownEvent)
    if (!event) return
    await db.cycleEvents.put({ id: `${program.id}-${cycleWeek}-${event.type}`, programId: program.id, cycleWeek, eventType: event.type as any, snoozedUntil: new Date(Date.now() + 86400000).toISOString() })
    setShownEvent(null)
  }

  function cycleWorkout() {
    const idx = ALL_WORKOUTS.indexOf(selectedTemplateId)
    const next = ALL_WORKOUTS[(idx + 1) % ALL_WORKOUTS.length]
    setSelectedTemplateId(next)
  }

  const currentEvent = cycleEvents.find(e => e.type === shownEvent)
  const isWeek5or6 = shownEvent === 'week5_action_swap' || shownEvent === 'week6_new_cycle'

  return (
    <div className="p-4 pb-2 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{displayDate}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-text-dim text-sm">周{Math.ceil(cycleWeek)}·{program?.name}</span>
            {isDeload && <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full font-medium">减载周</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${
            !user ? 'bg-surface-border text-text-dim' :
            syncStatus === 'synced' ? 'bg-primary/20 text-primary' :
            syncStatus === 'syncing' ? 'bg-accent/20 text-accent' :
            syncStatus === 'error' ? 'bg-red-500/20 text-red-400' :
            'bg-yellow-500/20 text-yellow-400'
          }`}>
            {!user ? '本地模式' :
             syncStatus === 'synced' ? '已同步' :
             syncStatus === 'syncing' ? '同步中' :
             syncStatus === 'error' ? '同步失败' : '待同步'}
          </span>
        </div>
      </div>

      {/* Cycle Event Alert */}
      {currentEvent && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 space-y-2">
          <h3 className="font-semibold text-accent">{currentEvent.title}</h3>
          <p className="text-text-secondary text-sm">{currentEvent.message}</p>
          <div className="flex gap-2 pt-1 flex-wrap">
            <button onClick={handleDismissEvent} className="text-xs text-text-dim px-3 py-1.5 rounded-lg bg-surface-border/50">我知道了</button>
            <button onClick={handleSnoozeEvent} className="text-xs text-text-dim px-3 py-1.5 rounded-lg bg-surface-border/50">稍后提醒</button>
            {isWeek5or6 && <button onClick={() => navigate('/settings')} className="text-xs text-primary px-3 py-1.5 rounded-lg bg-primary/10">去调整计划</button>}
          </div>
        </div>
      )}

      {/* Today's Recommendation */}
      <div className="card">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-text-dim text-xs">今日训练</span>
            <h2 className="text-xl font-bold text-primary mt-0.5">{WORKOUT_LABELS[selectedTemplateId] || selectedTemplateId}</h2>
          </div>
          <div className="text-right">
            <span className="text-text-dim text-xs">本周期训练</span>
            <p className="text-text-primary font-semibold">{weekSessionCount}次</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="btn-primary flex-1 text-center text-lg" onClick={() => navigate(`/workout/${selectedTemplateId}`)}>开始训练</button>
          <button className="btn-secondary" onClick={cycleWorkout}>切换</button>
          <button className="btn-secondary" onClick={() => setShowPicker(true)}>▼</button>
        </div>
      </div>

      {/* Last Session */}
      {lastSession && (
        <div className="card" onClick={() => navigate(`/history/${lastSession.id}`)}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-text-dim text-xs">最近训练</span>
            <span className="text-text-dim text-xs">{formatDate(lastSession.startedAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{getWorkoutName(lastSession.workoutTemplateId)}</span>
            <span className="text-text-dim text-sm">·</span>
            <span className="text-text-secondary text-sm">{lastSession.durationSeconds ? formatDuration(lastSession.durationSeconds) : '进行中'}</span>
          </div>
          {lastSession.totalVolume !== undefined && lastSession.totalVolume > 0 && (
            <div className="mt-1 flex gap-4">
              <span className="text-text-dim text-sm">容量 <span className="text-text-primary font-medium">{lastSession.totalVolume} kg</span></span>
              <span className="text-text-dim text-sm">组数 <span className="text-text-primary font-medium">{lastSession.totalWorkSets}组</span></span>
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <span className="text-text-dim text-xs">周期进度</span>
          <p className="text-text-primary font-bold text-lg mt-1">第{cycleWeek}周</p>
          <div className="w-full bg-surface-border rounded-full h-1.5 mt-2">
            <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${(cycleWeek / 8) * 100}%` }} />
          </div>
        </div>
        <div className="card">
          <span className="text-text-dim text-xs">用户</span>
          <p className="text-text-primary font-bold text-sm mt-1 truncate">{user?.email || '未登录'}</p>
          <p className="text-text-dim text-xs mt-1">{user ? '已登录·云同步' : '离线可用'}</p>
        </div>
      </div>

      {/* Workout Picker Bottom Sheet */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowPicker(false)}>
          <div className="bg-surface-card w-full max-w-md rounded-t-2xl p-4 pb-safe-bottom animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-surface-border rounded-full mx-auto mb-4" />
            <h3 className="font-semibold mb-3 text-center">选择训练日</h3>
            <div className="space-y-1">
              {ALL_WORKOUTS.map(id => (
                <button key={id} className={`w-full text-left py-3 px-4 rounded-xl transition-colors ${selectedTemplateId === id ? 'bg-primary/10 text-primary font-medium' : 'text-text-primary hover:bg-surface-border/30'}`}
                  onClick={() => { setSelectedTemplateId(id); setShowPicker(false) }}>
                  {WORKOUT_LABELS[id]}
                </button>
              ))}
            </div>
            <button className="btn-secondary w-full mt-3" onClick={() => setShowPicker(false)}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}
