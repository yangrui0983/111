import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../hooks/useAppState'
import { useAuth } from '../hooks/useAuth'
import { db } from '../db/database'
import { isVibrationSupported, isStandalonePWA } from '../lib/vibration'
import { formatDate, nowISO } from '../lib/volume'
import type { WorkoutTemplate } from '../types'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { program, settings, syncStatus, runSync, initProgram, updateSettings } = useAppState()
  const { user, isConfigured, signOut, loading: authLoading } = useAuth()
  const [showConfirm, setShowConfirm] = useState(false)
  const [showCycleConfirm, setShowCycleConfirm] = useState(false)
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    const t = (await db.workoutTemplates.toArray()).sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    setTemplates(t)
  }

  async function handleSyncWithFeedback() {
    setSyncMessage(null)
    try {
      await runSync()
      setSyncMessage({ type: 'success', text: '同步成功' })
    } catch {
      setSyncMessage({ type: 'error', text: '同步失败，请检查网络后重试' })
    }
    setTimeout(() => setSyncMessage(null), 4000)
  }

  async function handleClearData() {
    await db.delete()
    window.location.reload()
  }

  return (
    <div className="p-4 pb-2 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">设置</h1>

      {/* Account */}
      <div className="card">
        <h3 className="font-semibold mb-3">账号</h3>
        {authLoading ? <p className="text-text-dim text-sm">加载中...</p> : user ? (
          <div className="space-y-2">
            <div className="flex justify-between items-center"><span className="text-text-secondary text-sm">已登录</span><span className="text-text-primary text-sm">{user.email}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary text-sm">同步状态</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${syncStatus === 'synced' ? 'bg-primary/20 text-primary' : syncStatus === 'syncing' ? 'bg-accent/20 text-accent' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {syncStatus === 'synced' ? '已同步' : syncStatus === 'syncing' ? '同步中' : '待同步'}
              </span>
            </div>
            {syncMessage && (
              <div className={`text-xs px-3 py-1.5 rounded-lg ${syncMessage.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-400'}`}>
                {syncMessage.text}
              </div>
            )}
            <button className="btn-secondary w-full text-sm" onClick={handleSyncWithFeedback}>手动同步</button>
            <button className="btn-secondary w-full text-sm text-red-400" onClick={signOut}>退出登录</button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-text-dim text-sm">未登录，数据仅保存在本地</p>
            {isConfigured ? (
              <button className="btn-primary w-full" onClick={() => navigate('/auth')}>登录 / 注册</button>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-400">
                未配置 Supabase 环境变量，账号功能不可用。<br />本地模式完全可用，数据存储在设备上。
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Plans */}
      <div className="card">
        <h3 className="font-semibold mb-3">训练计划</h3>
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="flex items-center justify-between py-2 border-b border-surface-border/50 last:border-0">
              <div>
                <span className="font-medium">{t.name}</span>
                <span className="text-text-dim text-xs ml-2">{t.estimatedDurationMin}分钟</span>
              </div>
              <button className="text-primary text-sm" onClick={() => navigate(`/settings/plan/${t.id}`)}>编辑</button>
            </div>
          ))}
        </div>
      </div>

      {/* Training Settings */}
      <div className="card">
        <h3 className="font-semibold mb-3">训练设置</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-sm">训练提醒</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={settings?.reminderEnabled ?? false} onChange={e => updateSettings({ reminderEnabled: e.target.checked })} />
              <div className="w-11 h-6 bg-surface-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
            </label>
          </div>
          {settings?.reminderEnabled && (
            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-sm">提醒时间</span>
              <input type="time" className="bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-text-primary text-sm" value={settings.reminderTime || '19:30'} onChange={e => updateSettings({ reminderTime: e.target.value })} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-sm">震动提醒</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={settings?.vibrationEnabled ?? true} onChange={e => updateSettings({ vibrationEnabled: e.target.checked })} />
              <div className="w-11 h-6 bg-surface-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
            </label>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-sm">声音提醒</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={settings?.soundEnabled ?? true} onChange={e => updateSettings({ soundEnabled: e.target.checked })} />
              <div className="w-11 h-6 bg-surface-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
            </label>
          </div>
          {!isVibrationSupported() && <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-xs text-yellow-400">当前设备不支持震动 API，将使用声音和视觉提醒替代。</div>}
        </div>
      </div>

      {/* Cycle */}
      <div className="card">
        <h3 className="font-semibold mb-3">周期管理</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center"><span className="text-text-secondary text-sm">周期起始</span><span className="text-text-primary text-sm">{program ? formatDate(program.cycleStartDate) : '--'}</span></div>
          <button className="btn-secondary w-full text-sm" onClick={() => setShowCycleConfirm(true)}>开始新周期</button>
        </div>
      </div>

      {/* PWA Info */}
      <div className="card">
        <h3 className="font-semibold mb-3">应用信息</h3>
        <div className="space-y-2 text-sm text-text-secondary">
          <div className="flex justify-between"><span>PWA 模式</span><span>{isStandalonePWA() ? '已添加到主屏幕 ✓' : '未安装'}</span></div>
          <div className="flex justify-between"><span>推送通知</span><span className="text-text-dim">iOS 不支持</span></div>
          <p className="text-xs text-text-dim mt-1">添加到主屏幕：Safari → 分享按钮 → 添加到主屏幕</p>
        </div>
      </div>

      {/* About */}
      <div className="card">
        <h3 className="font-semibold mb-3">关于本计划</h3>
        <div className="text-sm text-text-secondary space-y-1">
          <p>PPL 增肌训练记录工具 v2.0</p>
          <p>基于推-拉-腿四分化循环的增肌计划。</p>
          <p>自动周期管理、渐进超负荷提醒、离线可用。</p>
        </div>
      </div>

      {/* Clear Data */}
      <div className="card border-red-500/30">
        <h3 className="font-semibold text-red-400 mb-3">危险操作</h3>
        {!showConfirm ? (
          <button className="btn-secondary w-full text-sm text-red-400 border-red-500/30" onClick={() => setShowConfirm(true)}>清空本地数据</button>
        ) : (
          <div className="space-y-2">
            <p className="text-red-400 text-sm">确定清空所有本地数据？此操作不可撤销！</p>
            <div className="flex gap-2">
              <button className="flex-1 btn-secondary text-sm" onClick={() => setShowConfirm(false)}>取消</button>
              <button className="flex-1 bg-red-500/20 text-red-400 font-medium rounded-xl py-3 text-sm" onClick={handleClearData}>确认清空</button>
            </div>
          </div>
        )}
      </div>

      {showCycleConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="card max-w-sm w-full space-y-4">
            <h3 className="font-semibold">开始新周期</h3>
            <p className="text-text-secondary text-sm">重置周期周数从第1周开始。</p>
            <div className="flex gap-2">
              <button className="flex-1 btn-secondary text-sm" onClick={() => setShowCycleConfirm(false)}>取消</button>
              <button className="flex-1 btn-primary text-sm" onClick={initProgram}>确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
