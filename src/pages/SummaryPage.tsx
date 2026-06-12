import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../db/database'
import { getNextWorkout, getWorkoutName } from '../lib/cycle'
import { calculateExerciseVolume, getBestSet, getMaxWeight } from '../lib/progression'
import { formatDuration, formatWeight, formatDate } from '../lib/volume'
import type { WorkoutSession, SessionSet } from '../types'

interface ExerciseSummary {
  name: string
  volume: number
  maxWeight: number
  bestSet: SessionSet | null
}

export default function SummaryPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [exercises, setExercises] = useState<ExerciseSummary[]>([])
  const [prevSession, setPrevSession] = useState<WorkoutSession | null>(null)
  const [prevExercises, setPrevExercises] = useState<ExerciseSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return
    loadData()
  }, [sessionId])

  async function loadData() {
    const s = await db.workoutSessions.get(sessionId!)
    if (!s) return
    setSession(s)

    const sessionExercises = await db.sessionExercises
      .where('workoutSessionId').equals(sessionId!)
      .sortBy('orderIndex')

    const summaries: ExerciseSummary[] = []
    for (const ex of sessionExercises) {
      const sets = await db.sessionSets
        .where('sessionExerciseId').equals(ex.id)
        .filter(st => st.setType === 'working' && st.completed)
        .toArray()
      summaries.push({
        name: ex.nameSnapshot,
        volume: calculateExerciseVolume(sets),
        maxWeight: getMaxWeight(sets) ?? 0,
        bestSet: getBestSet(sets),
      })
    }
    setExercises(summaries)

    // Previous same workout
    const prevSessions = await db.workoutSessions
      .filter(ps => ps.id !== sessionId! && ps.workoutTemplateId === s.workoutTemplateId && ps.isComplete === true && ps.completedAt != null && ps.completedAt < s.startedAt)
      .reverse().toArray()

    if (prevSessions.length > 0) {
      const prev = prevSessions[0]
      setPrevSession(prev)
      const prevExs = await db.sessionExercises.where('workoutSessionId').equals(prev.id).sortBy('orderIndex')
      const pSummaries: ExerciseSummary[] = []
      for (const ex of prevExs) {
        const sets = await db.sessionSets.where('sessionExerciseId').equals(ex.id).filter(st => st.setType === 'working' && st.completed).toArray()
        pSummaries.push({ name: ex.nameSnapshot, volume: calculateExerciseVolume(sets), maxWeight: getMaxWeight(sets) ?? 0, bestSet: getBestSet(sets) })
      }
      setPrevExercises(pSummaries)
    }
    setLoading(false)
  }

  if (loading || !session) {
    return <div className="h-full flex items-center justify-center bg-surface"><div className="animate-pulse text-text-dim">加载中...</div></div>
  }

  const nextTemplateId = getNextWorkout(session.workoutTemplateId)
  const nextName = getWorkoutName(nextTemplateId)
  const currentName = getWorkoutName(session.workoutTemplateId)
  const volumeChange = prevSession ? ((session.totalVolume ?? 0) - (prevSession.totalVolume ?? 0)) : null
  const durationChange = prevSession ? ((session.durationSeconds ?? 0) - (prevSession.durationSeconds ?? 0)) : null

  return (
    <div className="h-full bg-surface overflow-y-auto">
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="text-center pt-4 pb-2">
          <div className="text-4xl mb-2">💪</div>
          <h1 className="text-2xl font-bold">训练完成！</h1>
          <p className="text-text-secondary text-sm mt-1">{currentName} · {formatDate(session.startedAt)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center"><span className="text-text-dim text-xs">总用时</span><p className="text-xl font-bold mt-1">{session.durationSeconds ? formatDuration(session.durationSeconds) : '--'}</p></div>
          <div className="card text-center"><span className="text-text-dim text-xs">总容量</span><p className="text-xl font-bold mt-1">{session.totalVolume ? `${session.totalVolume} kg` : '--'}</p></div>
          <div className="card text-center"><span className="text-text-dim text-xs">完成动作</span><p className="text-xl font-bold mt-1">{exercises.length}</p></div>
          <div className="card text-center"><span className="text-text-dim text-xs">正式组数</span><p className="text-xl font-bold mt-1">{session.totalWorkSets ?? 0}</p></div>
        </div>

        {prevSession && (
          <div className="card">
            <h3 className="font-semibold mb-2">对比上次{currentName}</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-text-dim">总容量</span><span className={volumeChange !== null && volumeChange > 0 ? 'text-primary' : volumeChange !== null && volumeChange < 0 ? 'text-red-400' : 'text-text-secondary'}>{volumeChange !== null ? `${volumeChange > 0 ? '+' : ''}${volumeChange} kg` : '--'}</span></div>
              <div className="flex justify-between"><span className="text-text-dim">总用时</span><span className={durationChange !== null && durationChange < 0 ? 'text-primary' : durationChange !== null && durationChange > 0 ? 'text-red-400' : 'text-text-secondary'}>{durationChange !== null ? `${durationChange > 0 ? '+' : ''}${formatDuration(Math.abs(durationChange))}` : '--'}</span></div>
            </div>
          </div>
        )}

        <div className="card">
          <h3 className="font-semibold mb-3">动作详情</h3>
          <div className="space-y-3">
            {exercises.map((ex, i) => {
              const prevEx = prevExercises.find(p => p.name === ex.name)
              const chg = prevEx ? ex.volume - prevEx.volume : null
              return (
                <div key={i} className="bg-surface rounded-lg p-3 border border-surface-border/50">
                  <div className="flex justify-between items-center"><span className="font-medium">{ex.name}</span>{chg !== null && <span className={`text-xs ${chg > 0 ? 'text-primary' : chg < 0 ? 'text-red-400' : 'text-text-dim'}`}>{chg > 0 ? '+' : ''}{chg} kg</span>}</div>
                  <div className="flex gap-3 mt-1.5 text-xs text-text-secondary"><span>容量 {ex.volume} kg</span><span>最高 {formatWeight(ex.maxWeight)} kg</span>{ex.bestSet && <span>最佳 {ex.bestSet.reps}次@{formatWeight(ex.bestSet.weight)}</span>}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div><span className="text-text-dim text-xs">下次建议</span><p className="text-lg font-bold text-primary">{nextName}</p></div>
            <button className="btn-primary text-sm" onClick={() => navigate(`/workout/${nextTemplateId}`)}>开始</button>
          </div>
        </div>

        <button className="btn-secondary w-full" onClick={() => navigate('/')}>返回首页</button>
      </div>
    </div>
  )
}
