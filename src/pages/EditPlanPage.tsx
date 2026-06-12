import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/database'
import { getWorkoutName } from '../lib/cycle'
import { nowISO, generateId } from '../lib/volume'
import type { WorkoutTemplateExercise, ExerciseLibraryItem, WorkoutTemplate } from '../types'

export default function EditPlanPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null)
  const [wtes, setWtes] = useState<WorkoutTemplateExercise[]>([])
  const [libMap, setLibMap] = useState<Record<string, ExerciseLibraryItem>>({})
  const [allLib, setAllLib] = useState<ExerciseLibraryItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [editItem, setEditItem] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [templateId])

  async function loadData() {
    if (!templateId) return
    const t = await db.workoutTemplates.get(templateId)
    setTemplate(t ?? null)

    const items = await db.workoutTemplateExercises
      .where('workoutTemplateId').equals(templateId)
      .sortBy('orderIndex')
    setWtes(items)

    const lib = await db.exerciseLibrary.toArray()
    const map: Record<string, ExerciseLibraryItem> = {}
    for (const l of lib) map[l.id] = l
    setLibMap(map)
    setAllLib(lib)
  }

  async function handleRemove(wteId: string) {
    await db.workoutTemplateExercises.delete(wteId)
    setWtes(prev => {
      const updated = prev.filter(w => w.id !== wteId)
      // Re-index
      updated.forEach((w, i) => { w.orderIndex = i + 1; db.workoutTemplateExercises.update(w.id, { orderIndex: i + 1 }) })
      return updated
    })
  }

  async function handleAdd(exerciseId: string) {
    const lib = allLib.find(l => l.id === exerciseId)
    if (!lib) return
    const wte: WorkoutTemplateExercise = {
      id: generateId(),
      workoutTemplateId: templateId!,
      exerciseId: lib.id,
      displayName: lib.name,
      orderIndex: wtes.length + 1,
      targetSets: 3,
      minReps: 8,
      maxReps: 12,
      restSecondsMin: 60,
      restSecondsMax: 90,
      warmupSets: 1,
      warmupPercent: 50,
      isEachSide: false,
    }
    await db.workoutTemplateExercises.put(wte)
    setWtes(prev => [...prev, wte])
    setShowAdd(false)
    setSearch('')
  }

  async function handleUpdate(wteId: string, field: string, value: any) {
    await db.workoutTemplateExercises.update(wteId, { [field]: value })
    setWtes(prev => prev.map(w => w.id === wteId ? { ...w, [field]: value } : w))
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return
    const updated = [...wtes]
    const temp = updated[index - 1]
    updated[index - 1] = { ...updated[index - 1], orderIndex: index + 1 }
    updated[index] = { ...updated[index], orderIndex: index }
    await db.workoutTemplateExercises.update(updated[index - 1].id, { orderIndex: updated[index - 1].orderIndex })
    await db.workoutTemplateExercises.update(updated[index].id, { orderIndex: updated[index].orderIndex })
    // Swap
    const a = updated[index - 1], b = updated[index]
    updated[index - 1] = b
    updated[index] = a
    setWtes(updated)
  }

  async function handleMoveDown(index: number) {
    if (index >= wtes.length - 1) return
    handleMoveUp(index + 1)
  }

  async function handleCreateCustom() {
    const name = prompt('输入自定义动作名称:')
    if (!name) return
    const id = `custom-${generateId()}`
    const lib: ExerciseLibraryItem = {
      id, name, muscleGroup: '其他', movementPattern: 'push', equipment: 'dumbbell',
      isCustom: true, createdAt: nowISO(), updatedAt: nowISO(),
    }
    await db.exerciseLibrary.put(lib)
    setAllLib(prev => [...prev, lib])
    setLibMap(prev => ({ ...prev, [id]: lib }))
    await handleAdd(id)
  }

  const availableLib = allLib.filter(l => !wtes.some(w => w.exerciseId === l.id) && (!search || l.name.includes(search)))

  if (!template) return <div className="p-4 animate-pulse text-text-dim text-center py-12">加载中...</div>

  return (
    <div className="p-4 pb-2 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button className="btn-ghost text-xl" onClick={() => navigate('/settings')}>←</button>
        <h1 className="text-xl font-bold">编辑：{template.name}</h1>
      </div>

      {/* Exercise list */}
      <div className="space-y-2">
        {wtes.map((wte, idx) => {
          const lib = libMap[wte.exerciseId]
          return (
            <div key={wte.id} className="card">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-text-dim text-xs w-5">{idx + 1}</span>
                  <div>
                    <span className="font-medium">{wte.displayName}</span>
                    <span className="text-text-dim text-xs ml-2">{lib?.muscleGroup}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="text-text-dim text-xs px-2 py-1" onClick={() => handleMoveUp(idx)} disabled={idx === 0}>↑</button>
                  <button className="text-text-dim text-xs px-2 py-1" onClick={() => handleMoveDown(idx)} disabled={idx >= wtes.length - 1}>↓</button>
                  <button className="text-red-400 text-xs px-2 py-1" onClick={() => handleRemove(wte.id)}>✕</button>
                </div>
              </div>

              {editItem === wte.id ? (
                <div className="mt-2 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-text-dim text-[10px]">组数</label><input type="number" className="input-field w-full py-1 text-sm" value={wte.targetSets} onChange={e => handleUpdate(wte.id, 'targetSets', parseInt(e.target.value) || 3)} /></div>
                    <div><label className="text-text-dim text-[10px]">次数</label><input type="text" className="input-field w-full py-1 text-sm" value={`${wte.minReps}-${wte.maxReps}`} onChange={e => { const [min, max] = e.target.value.split('-').map(Number); if (min) handleUpdate(wte.id, 'minReps', min); if (max) handleUpdate(wte.id, 'maxReps', max) }} /></div>
                    <div><label className="text-text-dim text-[10px]">休息(秒)</label><input type="text" className="input-field w-full py-1 text-sm" value={`${wte.restSecondsMin}-${wte.restSecondsMax}`} onChange={e => { const [min, max] = e.target.value.split('-').map(Number); if (min) handleUpdate(wte.id, 'restSecondsMin', min); if (max) handleUpdate(wte.id, 'restSecondsMax', max) }} /></div>
                    <div><label className="text-text-dim text-[10px]">热身组</label><input type="number" className="input-field w-full py-1 text-sm" value={wte.warmupSets} onChange={e => handleUpdate(wte.id, 'warmupSets', parseInt(e.target.value) || 0)} /></div>
                  </div>
                  <button className="text-primary text-xs" onClick={() => setEditItem(null)}>完成</button>
                </div>
              ) : (
                <div className="flex gap-3 mt-1 text-xs text-text-secondary">
                  <span>{wte.targetSets}组</span>
                  <span>{wte.minReps}-{wte.maxReps}次</span>
                  <span>休息{wte.restSecondsMin}-{wte.restSecondsMax}秒</span>
                  {wte.warmupSets > 0 && <span>热身{wte.warmupSets}组</span>}
                  <button className="text-primary ml-auto" onClick={() => setEditItem(wte.id)}>编辑</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add exercise */}
      {!showAdd ? (
        <button className="btn-secondary w-full" onClick={() => setShowAdd(true)}>+ 新增动作</button>
      ) : (
        <div className="card space-y-2">
          <input className="input-field w-full" placeholder="搜索动作或自定义..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {availableLib.slice(0, 15).map(l => (
              <button key={l.id} className="w-full text-left py-2 px-3 rounded-lg hover:bg-surface-border/50 flex justify-between items-center" onClick={() => handleAdd(l.id)}>
                <span className="text-sm">{l.name}</span>
                <span className="text-text-dim text-xs">{l.muscleGroup}</span>
              </button>
            ))}
          </div>
          <button className="text-primary text-sm" onClick={handleCreateCustom}>+ 创建自定义动作</button>
          <button className="text-text-dim text-sm" onClick={() => { setShowAdd(false); setSearch('') }}>取消</button>
        </div>
      )}

      <button className="btn-secondary w-full" onClick={() => navigate('/settings')}>返回设置</button>
    </div>
  )
}
