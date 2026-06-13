import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppState } from '../hooks/useAppState'
import { db } from '../db/database'
import { checkProgressionTrigger } from '../lib/progression'
import { getDeloadWeight, getDeloadSets } from '../lib/cycle'
import { vibrate, playNotificationSound } from '../lib/vibration'
import { formatTimer, formatWeight, nowISO, generateId } from '../lib/volume'
import type { ExerciseLibraryItem, WorkoutTemplateExercise, SessionExercise, SessionSet } from '../types'

interface WorkoutExercise {
  templateExercise: WorkoutTemplateExercise
  libraryItem: ExerciseLibraryItem
  sessionExercise: SessionExercise
  sets: SessionSet[]
}

interface ProgressionDialog {
  show: boolean
  exerciseName: string
  exerciseId: string
  currentWeight: number
}

type AdjustMode = 'replace' | 'add' | null

const WORKOUT_NAMES: Record<string, string> = { 'push-a': '推日A', 'pull-a': '拉日A', 'legs': '腿日', 'compound': '综合复合日' }

export default function WorkoutPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const { cycleWeek, isDeload } = useAppState()

  const [sessionId, setSessionId] = useState('')
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0)
  const [currentSetIdx, setCurrentSetIdx] = useState(0)
  const [phase, setPhase] = useState<'exercising' | 'resting'>('exercising')
  const [restSeconds, setRestSeconds] = useState(0)
  const [restTotal, setRestTotal] = useState(0)
  const [isRestActive, setIsRestActive] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [repsInput, setRepsInput] = useState('')
  const [progressionDlg, setProgressionDlg] = useState<ProgressionDialog | null>(null)
  const [adjustMode, setAdjustMode] = useState<AdjustMode>(null)
  const [allLibItems, setAllLibItems] = useState<ExerciseLibraryItem[]>([])
  const [startTime] = useState(nowISO())
  // Search state for add/replace dialogs
  const [searchQuery, setSearchQuery] = useState('')
  const [progressionTip, setProgressionTip] = useState('')

  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const advancingRef = useRef(false)

  const currentExercise = exercises[currentExerciseIdx]
  const currentSet = currentExercise?.sets[currentSetIdx]

  // Compute derived values from live state
  const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0)
  const completedSets = exercises.reduce((s, e) => s + e.sets.filter(st => st.completed).length, 0)
  const setTypeLabel = currentSet?.setType === 'warmup' ? '热身' : '正式'
  const workingSetNum = currentExercise ? currentExercise.sets.filter(s => s.setType === 'working').findIndex(s => s.id === currentSet?.id) + 1 : 0
  const totalWorking = currentExercise ? currentExercise.sets.filter(s => s.setType === 'working').length : 0

  // Init
  useEffect(() => {
    if (!templateId) return
    initWorkout()
  }, [templateId])

  // Cleanup
  useEffect(() => {
    return () => { if (restTimerRef.current) clearInterval(restTimerRef.current) }
  }, [])

  // Auto-fill weight when entering a new set
  useEffect(() => {
    if (!currentSet || phase !== 'exercising') return
    if (currentSet.completed) return

    // Set weight: prefer pre-filled weight from DB, else copy from last completed set in this exercise
    if (currentSet.weight > 0) {
      setWeightInput(currentSet.weight.toString())
    } else {
      const lastCompleted = currentExercise?.sets
        .filter(s => s.setType === 'working' && s.completed && s.weight > 0)
      if (lastCompleted && lastCompleted.length > 0) {
        setWeightInput(lastCompleted[lastCompleted.length - 1].weight.toString())
      } else {
        setWeightInput('')
      }
    }
    // Load progression tip for this exercise
    if (currentExercise && phase === 'exercising' && currentSetIdx === 0) {
      db.progressionSuggestions
        .where('exerciseId').equals(currentExercise.libraryItem.id)
        .filter(s => s.accepted && s.increment > 0)
        .last()
        .then(s => {
          if (s) setProgressionTip(`上次连续两组达标，建议本次尝试 ${formatWeight(s.suggestedWeight)} kg`)
          else setProgressionTip('')
        })
    } else if (currentSetIdx > 0) {
      setProgressionTip('')
    }
    // Set reps: empty by default — user types manually
    setRepsInput('')
  }, [currentExerciseIdx, currentSetIdx, phase])

  async function initWorkout() {
    const id = generateId()
    setSessionId(id)
    const now = nowISO()

    await db.workoutSessions.put({
      id, programId: 'default', workoutTemplateId: templateId!,
      startedAt: now, cycleWeek, isDeload, isComplete: false,
      createdAt: now, updatedAt: now, syncStatus: 'pending',
    })

    const wtes = await db.workoutTemplateExercises
      .where('workoutTemplateId').equals(templateId!)
      .sortBy('orderIndex')

    const allLib: ExerciseLibraryItem[] = await db.exerciseLibrary.toArray()
    setAllLibItems(allLib)

    const workout: WorkoutExercise[] = []

    for (const wte of wtes) {
      const lib = allLib.find(e => e.id === wte.exerciseId)
      if (!lib) continue

      const seId = generateId()
      const se: SessionExercise = {
        id: seId, workoutSessionId: id, exerciseId: lib.id,
        nameSnapshot: wte.displayName, muscleGroupSnapshot: lib.muscleGroup,
        orderIndex: wte.orderIndex, targetSets: wte.targetSets,
        wasReplaced: false, originalTemplateExerciseId: wte.id,
      }
      await db.sessionExercises.put(se)

      const allSets: SessionSet[] = []
      let setIdx = 0

      const warmup = isDeload ? getDeloadSets(wte.warmupSets) : wte.warmupSets
      for (let w = 0; w < warmup; w++) {
        allSets.push({ id: generateId(), sessionExerciseId: seId, setIndex: setIdx++, setType: 'warmup', weight: 0, reps: 0, completed: false, restSecondsPlanned: wte.restSecondsMin })
      }

      const target = isDeload ? getDeloadSets(wte.targetSets) : wte.targetSets
      for (let s = 0; s < target; s++) {
        allSets.push({ id: generateId(), sessionExerciseId: seId, setIndex: setIdx++, setType: 'working', weight: 0, reps: 0, completed: false, restSecondsPlanned: wte.restSecondsMin })
      }

      for (const st of allSets) await db.sessionSets.put(st)
      workout.push({ templateExercise: wte, libraryItem: lib, sessionExercise: se, sets: allSets })
    }

    // Pre-fill weights from last session
    for (const we of workout) {
      const hasSuggestion = await db.progressionSuggestions
        .where('exerciseId').equals(we.libraryItem.id)
        .filter(s => s.accepted && s.increment > 0)
        .last()
      const lastWt = await getLastWeight(we.libraryItem.id)
      if (lastWt !== null) {
        const w = isDeload ? getDeloadWeight(lastWt) : lastWt
        for (const s of we.sets.filter(s => s.setType === 'working')) {
          s.weight = w
          await db.sessionSets.update(s.id, { weight: w })
        }
      }
      // If weight came from a progression suggestion, show a tip on first render
      if (hasSuggestion && we === workout[0]) {
        setProgressionTip(`上次连续两组达标，建议本次尝试 ${formatWeight(hasSuggestion.suggestedWeight)} kg`)
      }
    }

    setExercises(workout)
  }

  async function getLastWeight(exerciseId: string): Promise<number | null> {
    // First check if there's an accepted progression suggestion
    const suggestion = await db.progressionSuggestions
      .where('exerciseId').equals(exerciseId)
      .filter(s => s.accepted && s.increment > 0)
      .last()
    if (suggestion) {
      return suggestion.suggestedWeight
    }

    // Fall back to last actual weight used
    const lastSessions = await db.workoutSessions.filter(s => s.isComplete && s.id !== sessionId).reverse().toArray()
    for (const session of lastSessions) {
      const ex = await db.sessionExercises.where('workoutSessionId').equals(session.id).filter(e => e.exerciseId === exerciseId).first()
      if (ex) {
        const sets = await db.sessionSets.where('sessionExerciseId').equals(ex.id).filter(s => s.setType === 'working' && s.completed && s.weight > 0).toArray()
        if (sets.length > 0) return sets[0].weight
      }
    }
    return null
  }

  // ---- Rest timer ----
  function startRest(plannedSec: number) {
    setPhase('resting')
    setRestTotal(plannedSec)
    setRestSeconds(plannedSec)
    setIsRestActive(true)
    if (restTimerRef.current) clearInterval(restTimerRef.current)

    restTimerRef.current = setInterval(() => {
      setRestSeconds(prev => {
        if (prev <= 1) {
          clearInterval(restTimerRef.current!)
          restTimerRef.current = null
          setIsRestActive(false)
          vibrate([200, 100, 200])
          playNotificationSound()
          // Auto-advance to next set
          if (!advancingRef.current) {
            advancingRef.current = true
            // Use setTimeout to avoid setState clashes inside setInterval callback
            setTimeout(() => { advancingRef.current = false; advance() }, 100)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function skipRest() {
    if (restTimerRef.current) { clearInterval(restTimerRef.current); restTimerRef.current = null }
    setIsRestActive(false)
    setRestSeconds(0)
    advance()
  }

  function adjustRest(sec: number) {
    setRestSeconds(prev => Math.max(0, prev + sec))
  }

  // ---- Set completion ----
  async function handleSetComplete() {
    if (!currentSet || !currentExercise) return
    const weight = parseFloat(weightInput) || 0
    const reps = parseInt(repsInput, 10) || 0
    const now = nowISO()

    // Update Dexie
    await db.sessionSets.update(currentSet.id, { weight, reps, completed: true, startedAt: now, completedAt: now })

    // Update local state
    const updatedExercises = exercises.map(ex => {
      if (ex.sessionExercise.id !== currentExercise.sessionExercise.id) return ex
      return {
        ...ex,
        sets: ex.sets.map(s => s.id === currentSet.id ? { ...s, weight, reps, completed: true, startedAt: now, completedAt: now } : s)
      }
    })
    setExercises(updatedExercises)

    // Update inputs for next set
    setWeightInput(weight.toString())
    setRepsInput('')

    // Progression check
    if (currentSet.setType === 'working' && reps >= currentExercise.templateExercise.maxReps) {
      const updatedSets = updatedExercises[currentExerciseIdx].sets
      const { triggered } = checkProgressionTrigger(updatedSets, currentExercise.templateExercise.maxReps)
      if (triggered) {
        const first = updatedSets.find(s => s.setType === 'working' && s.completed && s.weight > 0)
        setProgressionDlg({
          show: true,
          exerciseName: currentExercise.templateExercise.displayName,
          exerciseId: currentExercise.libraryItem.id,
          currentWeight: first?.weight || weight,
        })
      }
    }

    const restTime = currentSet.restSecondsPlanned || 90
    startRest(restTime)
  }

  function handleProgressionAccept(increment: number) {
    if (!progressionDlg) return
    db.progressionSuggestions.put({
      id: generateId(), exerciseId: progressionDlg.exerciseId,
      baseWeight: progressionDlg.currentWeight,
      suggestedWeight: Math.round((progressionDlg.currentWeight + increment) * 2) / 2,
      increment, reason: '连续两组达到目标上限', accepted: true, createdAt: nowISO(),
    })
    setProgressionDlg(null)
  }

  function handleSkipExercise() {
    for (const s of currentExercise.sets) {
      if (!s.completed) db.sessionSets.update(s.id, { completed: false })
    }
    advance()
  }

  function advance() {
    if (!currentExercise) return
    const nextSet = currentSetIdx + 1
    if (nextSet < currentExercise.sets.length) {
      setCurrentSetIdx(nextSet)
      setPhase('exercising')
      setIsRestActive(false)
      setRestSeconds(0)
      return
    }
    const nextEx = currentExerciseIdx + 1
    if (nextEx < exercises.length) {
      setCurrentExerciseIdx(nextEx)
      setCurrentSetIdx(0)
      setPhase('exercising')
      setIsRestActive(false)
      setRestSeconds(0)
      return
    }
    finishWorkout()
  }

  function copyLastWeight() {
    const completed = currentExercise?.sets.filter(s => s.setType === 'working' && s.completed) ?? []
    if (completed.length > 0) setWeightInput(completed[completed.length - 1].weight.toString())
  }

  // ---- Replace / Add exercises ----
  async function handleReplaceExercise(newExerciseId: string) {
    if (!currentExercise) return
    const lib = allLibItems.find(l => l.id === newExerciseId)
    if (!lib) return

    await db.sessionExercises.update(currentExercise.sessionExercise.id, { wasReplaced: true })

    const seId = generateId()
    const se: SessionExercise = {
      id: seId, workoutSessionId: sessionId, exerciseId: lib.id,
      nameSnapshot: lib.name, muscleGroupSnapshot: lib.muscleGroup,
      orderIndex: currentExercise.templateExercise.orderIndex,
      targetSets: currentExercise.templateExercise.targetSets, wasReplaced: false,
    }
    await db.sessionExercises.put(se)

    const target = isDeload ? getDeloadSets(currentExercise.templateExercise.targetSets) : currentExercise.templateExercise.targetSets
    const sets: SessionSet[] = []
    for (let i = 0; i < target; i++) {
      sets.push({ id: generateId(), sessionExerciseId: seId, setIndex: i, setType: 'working', weight: 0, reps: 0, completed: false, restSecondsPlanned: currentExercise.templateExercise.restSecondsMin })
    }
    for (const st of sets) await db.sessionSets.put(st)

    const newEx: WorkoutExercise = {
      templateExercise: currentExercise.templateExercise,
      libraryItem: lib, sessionExercise: se, sets,
    }
    const updated = [...exercises]
    updated[currentExerciseIdx] = newEx
    setExercises(updated)
    setCurrentSetIdx(0)
    setWeightInput('')
    setRepsInput('')
    setAdjustMode(null)
  }

  async function handleAddExercise(exerciseId: string) {
    const lib = allLibItems.find(l => l.id === exerciseId)
    if (!lib) return

    const seId = generateId()
    const orderIdx = exercises.length
    const se: SessionExercise = {
      id: seId, workoutSessionId: sessionId, exerciseId: lib.id,
      nameSnapshot: lib.name, muscleGroupSnapshot: lib.muscleGroup,
      orderIndex: orderIdx, targetSets: 3, wasReplaced: false,
    }
    await db.sessionExercises.put(se)

    const sets: SessionSet[] = []
    for (let i = 0; i < 3; i++) {
      sets.push({ id: generateId(), sessionExerciseId: seId, setIndex: i, setType: 'working', weight: 0, reps: 0, completed: false, restSecondsPlanned: 90 })
    }
    for (const st of sets) await db.sessionSets.put(st)

    const newEx: WorkoutExercise = {
      templateExercise: {
        id: generateId(), workoutTemplateId: templateId!, exerciseId: lib.id,
        displayName: lib.name, orderIndex: orderIdx, targetSets: 3,
        minReps: 8, maxReps: 12, restSecondsMin: 90, restSecondsMax: 90,
        warmupSets: 0, warmupPercent: 0, isEachSide: false,
      },
      libraryItem: lib, sessionExercise: se, sets,
    }

    setExercises(prev => [...prev, newEx])
    setCurrentExerciseIdx(orderIdx)
    setCurrentSetIdx(0)
    setSearchQuery('')
    setAdjustMode(null)
  }

  async function finishWorkout() {
    // Re-read from Dexie for accuracy
    const allSessionExercises = await db.sessionExercises.where('workoutSessionId').equals(sessionId).toArray()
    let totalVolume = 0
    let totalWorkSets = 0

    for (const se of allSessionExercises) {
      const sets = await db.sessionSets.where('sessionExerciseId').equals(se.id).filter(s => s.setType === 'working' && s.completed).toArray()
      for (const s of sets) {
        totalVolume += s.weight * s.reps
        totalWorkSets++
      }
    }

    const endTime = nowISO()
    const durationSec = Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)

    await db.workoutSessions.update(sessionId, {
      completedAt: endTime, durationSeconds: durationSec,
      totalVolume, totalWorkSets, isComplete: true,
      updatedAt: nowISO(), syncStatus: 'pending',
    })

    navigate(`/summary/${sessionId}`)
  }

  async function saveAndExit() {
    if (currentSet && weightInput) {
      const w = parseFloat(weightInput) || 0
      const r = parseInt(repsInput, 10) || 0
      if (w > 0) await db.sessionSets.update(currentSet.id, { weight: w, reps: r, startedAt: nowISO(), completed: false })
    }
    navigate('/')
  }

  // Loading
  if (exercises.length === 0) {
    return <div className="h-full flex items-center justify-center bg-surface"><div className="animate-pulse text-text-dim">加载训练计划...</div></div>
  }

  // ---- Replace dialog ----
  if (adjustMode === 'replace') {
    const similar = allLibItems.filter(l =>
      l.muscleGroup === currentExercise?.libraryItem.muscleGroup &&
      l.id !== currentExercise?.libraryItem.id &&
      (!searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    return (
      <div className="h-full bg-surface p-4 overflow-y-auto space-y-3 animate-fade-in">
        <h2 className="text-lg font-bold">替换动作</h2>
        <p className="text-text-dim text-sm">当前：{currentExercise?.templateExercise.displayName}</p>
        <input className="input-field w-full" placeholder="搜索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        {similar.map(lib => (
          <button key={lib.id} className="card w-full text-left flex justify-between items-center"
            onClick={() => handleReplaceExercise(lib.id)}>
            <span className="font-medium">{lib.name}</span>
            <span className="text-text-dim text-xs">{lib.muscleGroup}</span>
          </button>
        ))}
        {similar.length === 0 && <p className="text-text-dim text-center py-4">无匹配动作</p>}
        <button className="btn-secondary w-full" onClick={() => { setAdjustMode(null); setSearchQuery('') }}>取消</button>
      </div>
    )
  }

  // ---- Add dialog ----
  if (adjustMode === 'add') {
    const usedIds = new Set(exercises.map(e => e.libraryItem.id))
    const available = allLibItems.filter(l => !usedIds.has(l.id) && (!searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase())))
    return (
      <div className="h-full bg-surface p-4 overflow-y-auto space-y-3 animate-fade-in">
        <h2 className="text-lg font-bold">新增动作</h2>
        <input className="input-field w-full" placeholder="搜索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
        {available.slice(0, 20).map(lib => (
          <button key={lib.id} className="card w-full text-left flex justify-between items-center"
            onClick={() => handleAddExercise(lib.id)}>
            <span className="font-medium">{lib.name}</span>
            <span className="text-text-dim text-xs">{lib.muscleGroup}</span>
          </button>
        ))}
        {available.length === 0 && <p className="text-text-dim text-center py-4">无匹配动作</p>}
        <button className="btn-secondary w-full" onClick={() => { setAdjustMode(null); setSearchQuery('') }}>取消</button>
      </div>
    )
  }

  // ---- Main workout UI ----
  return (
    <div className="h-full flex flex-col bg-surface">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-surface-border">
        <button className="btn-ghost text-sm" onClick={saveAndExit}>✕ 退出</button>
        <div className="text-center">
          <h1 className="font-semibold text-text-primary text-sm">{WORKOUT_NAMES[templateId!] || templateId}</h1>
          <div className="text-text-dim text-xs">{isDeload ? '减载周 · ' : ''}{completedSets}/{totalSets}组</div>
        </div>
        <button className="btn-ghost text-sm" onClick={finishWorkout}>完成</button>
      </div>

      <div className="w-full bg-surface-border h-1">
        <div className="bg-primary h-1 transition-all duration-300" style={{ width: `${(completedSets / totalSets) * 100}%` }} />
      </div>

      {progressionDlg?.show ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="card w-full max-w-sm text-center space-y-4">
            <h3 className="text-lg font-bold">渐进超负荷</h3>
            <p className="text-text-secondary">「{progressionDlg.exerciseName}」连续两组达到目标上限！</p>
            <div className="space-y-2">
              <button className="btn-primary w-full" onClick={() => handleProgressionAccept(2.5)}>+2.5 kg</button>
              <button className="btn-primary w-full" onClick={() => handleProgressionAccept(5)}>+5 kg</button>
              <button className="btn-secondary w-full" onClick={() => { const c = prompt('请输入增重(kg):', '2.5'); if (c) handleProgressionAccept(parseFloat(c) || 2.5) }}>自定义增重</button>
              <button className="btn-secondary w-full" onClick={() => {
                if (!progressionDlg) return;
                db.progressionSuggestions.put({
                  id: generateId(), exerciseId: progressionDlg.exerciseId,
                  baseWeight: progressionDlg.currentWeight,
                  suggestedWeight: progressionDlg.currentWeight,
                  increment: 0, reason: '先加次数递进',
                  accepted: true, createdAt: nowISO(),
                });
                setProgressionDlg(null)
              }}>先加次数（保持重量，多做1-2次）</button>
              <button className="text-text-dim text-sm pt-2 block w-full text-center" onClick={() => setProgressionDlg(null)}>暂不处理</button>
            </div>
          </div>
        </div>
      ) : phase === 'resting' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <p className="text-text-dim text-sm mb-4">休息中</p>
          <div className={`text-7xl font-bold tabular-nums ${isRestActive ? 'animate-pulse-rest' : ''}`}>{formatTimer(restSeconds)}</div>
          {isRestActive && (
            <div className="w-64 bg-surface-border rounded-full h-2 mt-4">
              <div className="bg-primary rounded-full h-2 transition-all duration-1000" style={{ width: `${(restSeconds / restTotal) * 100}%` }} />
            </div>
          )}
          <div className="flex gap-3 mt-6">
            <button className="btn-secondary text-sm" onClick={() => adjustRest(-15)}>-15s</button>
            <button className="btn-secondary text-sm" onClick={() => adjustRest(15)}>+15s</button>
          </div>
          <button className="btn-primary mt-4 px-8" onClick={skipRest}>跳过休息</button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="card">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-text-dim text-xs">{setTypeLabel}组</span>
                <h2 className="text-xl font-bold mt-0.5">{currentExercise?.templateExercise.displayName}</h2>
                <p className="text-text-dim text-sm mt-1">{currentExercise?.libraryItem.muscleGroup} · 目标{currentExercise?.templateExercise.minReps}-{currentExercise?.templateExercise.maxReps}次</p>
                {currentSet?.setType === 'working' && <p className="text-text-secondary text-sm mt-1">第{workingSetNum}/{totalWorking}组</p>}
              </div>
            </div>
            {currentSet?.weight > 0 && <div className="mt-2 bg-primary/10 text-primary text-sm rounded-lg px-3 py-1.5">建议重量：{formatWeight(currentSet.weight)} kg</div>}
            {progressionTip && <div className="mt-1 bg-yellow-500/10 text-yellow-400 text-xs rounded-lg px-3 py-1.5">{progressionTip}</div>}
          </div>

          <div className="space-y-2">
            <label className="text-text-dim text-xs">重量 (kg)</label>
            <input type="number" inputMode="decimal" className="input-field w-full text-2xl font-bold text-center" placeholder="0" value={weightInput} onChange={e => setWeightInput(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button className="btn-secondary flex-1 text-sm" onClick={() => setWeightInput(Math.max(0, (parseFloat(weightInput) || 0) - 2.5).toString())}>-2.5</button>
              <button className="btn-secondary flex-1 text-sm" onClick={copyLastWeight}>复制上组</button>
              <button className="btn-secondary flex-1 text-sm" onClick={() => setWeightInput(((parseFloat(weightInput) || 0) + 2.5).toString())}>+2.5</button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-text-dim text-xs">次数</label>
            <input type="number" inputMode="numeric" className="input-field w-full text-2xl font-bold text-center" placeholder="0" value={repsInput} onChange={e => setRepsInput(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-secondary flex-1 text-sm" onClick={() => setRepsInput(Math.max(0, (parseInt(repsInput, 10) || 0) - 1).toString())}>-1</button>
              <button className="btn-secondary flex-1 text-sm" onClick={() => setRepsInput(((parseInt(repsInput, 10) || 0) + 1).toString())}>+1</button>
            </div>
          </div>

          <button className="btn-primary w-full text-lg" onClick={handleSetComplete} disabled={!weightInput || !repsInput}>
            {currentSet?.setType === 'warmup' ? '✔ 完成热身组' : '✔ 完成这组'}
          </button>

          <div className="flex gap-2">
            <button className="btn-secondary flex-1 text-sm" onClick={handleSkipExercise}>跳过</button>
            <button className="btn-secondary flex-1 text-sm" onClick={() => setAdjustMode('replace')}>替换</button>
            <button className="btn-secondary flex-1 text-sm" onClick={() => setAdjustMode('add')}>+新增</button>
          </div>
        </div>
      )}
    </div>
  )
}
