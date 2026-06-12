import { useState, useEffect } from 'react'
import { db } from '../db/database'
import { calculateExerciseVolume, getMaxWeight, getBestSet } from '../lib/progression'
import { formatDate } from '../lib/volume'
import type { ExerciseLibraryItem } from '../types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ChartData {
  date: string
  volume: number
  maxWeight: number
  bestReps: number
}

export default function TrendsPage() {
  const [exercises, setExercises] = useState<ExerciseLibraryItem[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [chartType, setChartType] = useState<'volume' | 'weight' | 'reps'>('volume')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadExercises()
  }, [])

  useEffect(() => {
    if (selectedExerciseId) loadChartData(selectedExerciseId)
  }, [selectedExerciseId])

  async function loadExercises() {
    const sessionExercises = await db.sessionExercises.toArray()
    const idSet = new Set<string>()
    for (const se of sessionExercises) idSet.add(se.exerciseId)
    const wtes = await db.workoutTemplateExercises.toArray()
    for (const wte of wtes) idSet.add(wte.exerciseId)
    const allLib = await db.exerciseLibrary.toArray()
    const matched = allLib.filter(l => idSet.has(l.id))
    setExercises(matched)

    setLoading(false)
    // Load chart for first exercise immediately
    if (matched.length > 0) {
      const firstId = matched[0].id
      setSelectedExerciseId(firstId)
      await loadChartData(firstId)
    }
  }

  async function loadChartData(exerciseId?: string) {
    const eid = exerciseId || selectedExerciseId
    if (!eid) return

    const allSessions = await db.workoutSessions.filter(s => s.isComplete).reverse().sortBy('startedAt')
    const data: ChartData[] = []

    for (const session of allSessions) {
      const ex = await db.sessionExercises
        .where('workoutSessionId').equals(session.id)
        .filter(e => e.exerciseId === eid)
        .first()

      if (ex) {
        const sets = await db.sessionSets
          .where('sessionExerciseId').equals(ex.id)
          .filter(s => s.setType === 'working' && s.completed)
          .toArray()

        if (sets.length > 0) {
          const best = getBestSet(sets)
          data.push({
            date: formatDate(session.startedAt),
            volume: calculateExerciseVolume(sets),
            maxWeight: getMaxWeight(sets) ?? 0,
            bestReps: best?.reps ?? 0,
          })
        }
      }
    }

    setChartData(data.reverse())
  }

  const dataKey = chartType === 'volume' ? 'volume' : chartType === 'weight' ? 'maxWeight' : 'bestReps'
  const chartColor = chartType === 'volume' ? '#22C55E' : chartType === 'weight' ? '#3B82F6' : '#F59E0B'
  const unitLabel = chartType === 'volume' ? 'kg' : chartType === 'weight' ? 'kg' : '次'

  const filtered = exercises.filter(e => !search || e.name.includes(search) || e.muscleGroup.includes(search))

  if (loading) {
    return <div className="p-4"><div className="animate-pulse text-text-dim text-center py-12">加载中...</div></div>
  }

  return (
    <div className="p-4 pb-2 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">走势分析</h1>

      <div className="card">
        <input className="input-field w-full mb-2" placeholder="搜索动作..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input-field w-full" value={selectedExerciseId} onChange={e => setSelectedExerciseId(e.target.value)} size={Math.min(filtered.length, 6)} style={{ height: 'auto' }}>
          {filtered.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
        </select>
        {filtered.length === 0 && <p className="text-text-dim text-center py-4 text-sm">暂无记录的动作</p>}
      </div>

      <div className="flex gap-2">
        {(['volume', 'weight', 'reps'] as const).map(ct => (
          <button key={ct} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${chartType === ct ? 'bg-primary text-surface' : 'bg-surface-card text-text-secondary border border-surface-border'}`} onClick={() => setChartType(ct)}>
            {ct === 'volume' ? '容量曲线' : ct === 'weight' ? '最高重量' : '最佳次数'}
          </button>
        ))}
      </div>

      <div className="card">
        {chartData.length === 0 ? (
          <div className="text-center py-12"><div className="text-3xl mb-2">📊</div><p className="text-text-dim">暂无记录</p><p className="text-text-dim text-xs mt-1">完成训练后走势图会在这里显示</p></div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A3340" />
                <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#2A3340' }} />
                <YAxis tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#2A3340' }} width={30} />
                <Tooltip contentStyle={{ backgroundColor: '#1A2128', border: '1px solid #2A3340', borderRadius: '8px', color: '#F0F4F8', fontSize: '12px' }} formatter={(value: number) => [`${value} ${unitLabel}`, '']} />
                <Line type="monotone" dataKey={dataKey} stroke={chartColor} strokeWidth={2} dot={{ fill: chartColor, r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="card text-center py-2"><span className="text-text-dim text-[10px]">当前</span><p className="text-sm font-bold mt-0.5">{chartData[chartData.length - 1][dataKey]} {unitLabel}</p></div>
          <div className="card text-center py-2"><span className="text-text-dim text-[10px]">最高</span><p className="text-sm font-bold mt-0.5 text-primary">{Math.max(...chartData.map(d => d[dataKey]))} {unitLabel}</p></div>
          <div className="card text-center py-2"><span className="text-text-dim text-[10px]">记录次数</span><p className="text-sm font-bold mt-0.5">{chartData.length}次</p></div>
        </div>
      )}
    </div>
  )
}
