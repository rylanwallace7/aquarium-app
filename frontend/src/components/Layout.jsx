import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import Header from './Header'

function Layout() {
  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col geometric-bg">
      <Header />
      <main className="flex-1 p-4 pb-28 overflow-auto overscroll-contain">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

export default Layout
