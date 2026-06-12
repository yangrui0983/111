import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AuthPage() {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (isLogin) {
        const { error: err } = await signIn(email, password)
        if (err) {
          setError(err)
        } else {
          navigate('/')
        }
      } else {
        const { error: err } = await signUp(email, password)
        if (err) {
          setError(err)
        } else {
          setSuccess('注册成功！请检查邮箱确认。确认后即可登录。')
        }
      }
    } catch {
      setError('操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col justify-center p-6 bg-surface">
      <div className="max-w-sm mx-auto w-full space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="text-4xl mb-2">💪</div>
          <h1 className="text-2xl font-bold">PPL训练</h1>
          <p className="text-text-secondary text-sm mt-1">
            {isLogin ? '登录以同步数据' : '注册新账号'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-text-dim text-xs block mb-1">邮箱</label>
            <input
              type="email"
              className="input-field w-full"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-text-dim text-xs block mb-1">密码</label>
            <input
              type="password"
              className="input-field w-full"
              placeholder="至少6位密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm text-primary">
              {success}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? '处理中...' : isLogin ? '登录' : '注册'}
          </button>
        </form>

        <div className="text-center">
          <button
            className="text-text-dim text-sm"
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
              setSuccess('')
            }}
          >
            {isLogin ? '没有账号？去注册' : '已有账号？去登录'}
          </button>
        </div>

        <button
          className="btn-secondary w-full text-sm"
          onClick={() => navigate('/')}
        >
          跳过，先使用本地模式
        </button>
      </div>
    </div>
  )
}
