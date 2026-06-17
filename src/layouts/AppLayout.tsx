// layouts/AppLayout.tsx
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  PlusCircle, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  CreditCard,
  Shield,
  CalendarClock
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { useFollowups } from '../hooks/useFollowups';
import toast from 'react-hot-toast';

export function AppLayout() {
  const { user, userType, impersonatedUser, impersonateUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { todayCount } = useFollowups();

  const name = user?.user_metadata?.full_name ?? user?.email ?? 'User';
  const email = user?.email ?? '';
  const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Failed to sign out');
      console.error(error);
    }
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard, badge: 0 },
    { to: '/contacts',  label: 'Contacts',   icon: Users,           badge: 0 },
    { to: '/followups', label: 'Follow-ups', icon: CalendarClock,   badge: todayCount },
    { to: '/contacts/upload', label: 'Scan Card', icon: PlusCircle, badge: 0 },
    { to: '/settings',  label: 'Settings',   icon: Settings,        badge: 0 },
  ];

  if (userType === 'superadmin') {
    navItems.push({ to: '/admin', label: 'Admin Panel', icon: Shield, badge: 0 });
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      {impersonatedUser && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-3 shrink-0 shadow-sm border-b border-amber-600 sticky top-0 z-50">
          <span>
            You are currently impersonating <strong className="underline">{name}</strong> ({email})
          </span>
          <button 
            onClick={() => impersonateUser(null)}
            className="bg-amber-950 text-amber-100 hover:bg-amber-900 px-2 py-0.5 rounded transition-all font-bold uppercase tracking-wider text-[10px]"
          >
            Exit
          </button>
        </div>
      )}
      
      <div className="flex-1 flex min-h-0">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 p-5 shrink-0 justify-between">
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-brand-400 flex items-center justify-center">
              <CreditCard size={18} className="text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900 tracking-tight">CardFollowup</span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 
                  `nav-link ${isActive ? 'active' : ''}`
                }
              >
                <item.icon size={18} />
                {item.label}
                {item.badge > 0 && (
                  <span className="ml-auto min-w-[20px] h-5 px-1 rounded-full bg-brand-400 text-white text-[10px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Footer profile & logout */}
        <div className="border-t border-gray-100 pt-4 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-semibold text-sm">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
              <p className="text-xs text-gray-500 truncate">{email}</p>
            </div>
          </div>
          <button 
            onClick={handleSignOut} 
            className="w-full btn-ghost btn-sm flex items-center justify-start gap-3 hover:text-red-600 hover:bg-red-50 text-gray-600"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Navigation (Backdrop + Menu) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative flex flex-col w-4/5 max-w-sm bg-white p-6 shadow-2xl animate-fade-in-left justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-400 flex items-center justify-center">
                    <CreditCard size={16} className="text-white" />
                  </div>
                  <span className="font-bold text-gray-900">CardFollowup</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-md hover:bg-gray-100">
                  <X size={20} />
                </button>
              </div>

              <nav className="space-y-1">
                {navItems.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) => 
                      `nav-link ${isActive ? 'active' : ''}`
                    }
                  >
                    <item.icon size={18} />
                    {item.label}
                    {item.badge > 0 && (
                      <span className="ml-auto min-w-[20px] h-5 px-1 rounded-full bg-brand-400 text-white text-[10px] font-bold flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-semibold text-sm">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                  <p className="text-xs text-gray-500 truncate">{email}</p>
                </div>
              </div>
              <button 
                onClick={handleSignOut}
                className="w-full btn-ghost btn-sm flex items-center justify-start gap-3 text-gray-600 hover:text-red-600 hover:bg-red-50"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-16 md:pb-0">
        
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              <Menu size={22} />
            </button>
            <span className="font-bold text-gray-900 tracking-tight">CardFollowup</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-semibold text-xs">
            {initials}
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto page-enter">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-2 flex items-center justify-around z-40 shadow-lg bottom-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 
                `flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors
                 ${isActive ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'}`
              }
            >
              <item.icon size={20} className="stroke-[2.25px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      </div>

    </div>
  );
}
export default AppLayout;
