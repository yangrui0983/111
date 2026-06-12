import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  { path: '/', label: '今日', icon: '◉' },
  { path: '/history', label: '历史', icon: '☰' },
  { path: '/trends', label: '走势', icon: '↗' },
  { path: '/settings', label: '设置', icon: '⚙' },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="h-full flex flex-col">
      <main className="flex-1 overflow-y-auto pb-2">
        <Outlet />
      </main>
      <nav className="tab-bar flex justify-around pt-2 pb-safe-bottom">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path ||
            (tab.path !== '/' && location.pathname.startsWith(tab.path))
          return (
            <button
              key={tab.path}
              className={`flex flex-col items-center gap-1 tap-target px-4 py-1 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-text-dim'
              }`}
              onClick={() => navigate(tab.path)}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
