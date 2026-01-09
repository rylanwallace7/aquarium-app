import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/', icon: 'dashboard', label: 'Overview' },
  { path: '/specimens', icon: 'phishing', label: 'Specimens' },
  { path: '/logs', icon: 'build', label: 'Maint' },
  { path: '/hardware', icon: 'sensors', label: 'Sensors' },
  { path: '/settings', icon: 'settings', label: 'Settings' }
]

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-kurz-dark border-t-3 border-black flex items-center justify-around px-2 py-3">
      {navItems.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 w-16 py-2 rounded-xl transition-all ${
              isActive
                ? 'bg-kurz-bg text-kurz-dark'
                : 'text-white hover:bg-white/10'
            }`
          }
          end={item.path === '/'}
        >
          <span className="material-symbols-outlined text-lg">{item.icon}</span>
          <span className="text-[8px] font-bold uppercase tracking-wider">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default BottomNav
