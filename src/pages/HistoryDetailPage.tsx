import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../db/database'
import { getWorkoutName } from '../lib/cycle'
import { calculateExerciseVolume } from '../lib/progression'
import { formatDate, formatDuration, formatWeight } from '../lib/volume'
import type { WorkoutSession, SessionSet } from '../types'

interface DetailExercise {
  name: string
  sets: SessionSet[]
  volume: number
}

export default function HistoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [exercises, setExercises] = useState<DetailExercise[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    loadData()
  }, [id])

  async function loadData() {
    const s = await db.workoutSessions.get(id!)
    if (!s) return
    setSession(s)

    const sessionExercises = await db.sessionExercises
      .where('workoutSessionId').equals(id!)
      .sortBy('orderIndex')

    const details: DetailExercise[] = []
    for (const ex of sessionExercises) {
      const sets = await db.sessionSets
        .where('sessionExerciseId').equals(ex.id)
        .sortBy('setIndex')
      details.push({ name: ex.nameSnapshot, sets, volume: calculateExerciseVolume(sets) })
    }
    setExercises(details)
    setLoading(false)
  }

  if (loading || !session) {
    return <div className="p-4"><div className="animate-pulse text-text-dim text-center py-12">加载中...</div></div>
  }

  return (
    <div className="p-4 pb-2 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button className="btn-ghost text-xl" onClick={() => navigate('/history')}>←</button>
        <div><h1 className="text-xl font-bold">{getWorkoutName(session.workoutTemplateId)}</h1><p className="text-text-dim text-sm">{formatDate(session.startedAt)}</p></div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="card text-center py-2"><span className="text-text-dim text-[10px]">用时</span><p className="text-sm font-bold mt-0.5">{session.durationSeconds ? formatDuration(session.durationSeconds) : '--'}</p></div>
        <div className="card text-center py-2"><span className="text-text-dim text-[10px]">容量</span><p className="text-sm font-bold mt-0.5">{session.totalVolume ?? 0}</p></div>
        <div className="card text-center py-2"><span className="text-text-dim text-[10px]">动作</span><p className="text-sm font-bold mt-0.5">{exercises.length}</p></div>
        <div className="card text-center py-2"><span className="text-text-dim text-[10px]">组数</span><p className="text-sm font-bold mt-0.5">{session.totalWorkSets ?? 0}</p></div>
      </div>

      <div className="space-y-3">
        {exercises.map((ex, i) => (
          <div key={i} className="card">
            <div className="flex justify-between items-center mb-2"><h3 className="font-semibold">{ex.name}</h3><span className="text-text-dim text-xs">容量 {ex.volume} kg</span></div>
            <div className="space-y-1">
              {ex.sets.map(set => (
                <div key={set.id} className={`flex items-center justify-between text-sm py-1.5 px-2 rounded-lg ${set.setType === 'warmup' ? 'bg-surface/50' : ''} ${set.completed ? '' : 'opacity-40'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${set.setType === 'warmup' ? 'bg-yellow-500/20 text-yellow-400' : set.completed ? 'bg-primary/20 text-primary' : 'bg-surface-border text-text-dim'}`}>{set.setType === 'warmup' ? '热' : set.completed ? '✓' : '-'}</span>
                    <span className="text-text-dim text-xs">{set.setType === 'warmup' ? '热身' : `第${ex.sets.filter(s => s.setType === 'working').indexOf(set) + 1}组`}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {set.completed ? <><span className="font-medium">{formatWeight(set.weight)} kg</span><span className="text-text-secondary">{set.reps}次</span></> : <span className="text-text-dim text-xs">未完成</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
