import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import Header from './Header'

function Layout() {
  return (
    <div className="h-screen h-[100dvh] flex flex-col geometric-bg overflow-hidden">
      <Header />
      <main className="flex-1 p-4 pb-28 overflow-y-auto overscroll-contain">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

export default Layout
