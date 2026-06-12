import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/database'
import { getWorkoutName } from '../lib/cycle'
import { formatDate, formatDuration } from '../lib/volume'
import type { WorkoutSession } from '../types'

export default function HistoryPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessions()
  }, [])

  async function loadSessions() {
    const all = await db.workoutSessions
      .filter(s => s.isComplete)
      .reverse()
      .sortBy('startedAt')

    setSessions(all)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse text-text-dim text-center py-12">加载中...</div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-2 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">训练历史</h1>

      {sessions.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-text-dim">暂无训练记录</p>
          <p className="text-text-dim text-sm mt-1">完成一次训练后，记录会出现在这里</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(session => (
            <div
              key={session.id}
              className="card active:scale-[0.99] transition-transform cursor-pointer"
              onClick={() => navigate(`/history/${session.id}`)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">
                    {getWorkoutName(session.workoutTemplateId)}
                  </h3>
                  <p className="text-text-dim text-sm mt-0.5">
                    {formatDate(session.startedAt)}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  session.isDeload ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-primary/10 text-primary'
                }`}>
                  {session.isDeload ? '减载' : `第${session.cycleWeek}周`}
                </span>
              </div>

              <div className="flex gap-4 mt-2 text-sm">
                {session.durationSeconds && (
                  <span className="text-text-secondary">
                    用时 {formatDuration(session.durationSeconds)}
                  </span>
                )}
                {session.totalVolume !== undefined && session.totalVolume > 0 && (
                  <span className="text-text-secondary">
                    容量 {session.totalVolume} kg
                  </span>
                )}
                {session.totalWorkSets !== undefined && session.totalWorkSets > 0 && (
                  <span className="text-text-secondary">
                    {session.totalWorkSets}组
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
