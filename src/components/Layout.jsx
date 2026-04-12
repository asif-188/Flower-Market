import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, ChevronLeft, Globe, User } from 'lucide-react';
import { auth } from '../firebase';
import Petals from './Petals';

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname.includes('/dashboard');

  const handleLogout = async () => {
    try {
      if (window.confirm('Are you sure you want to log out?')) {
        await auth.signOut();
        navigate('/');
      }
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const getTitle = () => {
    if (location.pathname.includes('/buyer')) return 'Sales — Customer';
    if (location.pathname.includes('/sales')) return 'Sales';
    if (location.pathname.includes('/products')) return 'Products';
    if (location.pathname.includes('/payments')) return 'Sales — Cash Receive';
    if (location.pathname.includes('/reports')) return 'Sales — Customer Report';
    return '';
  };

  return (
    <div className="page page-main bg-gray-50 flex flex-col min-h-screen">
      <Petals />
      
      {/* ── Fixed Premium Top Bar ── */}
      <div className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center px-6 sticky top-0 z-50">
        
        {/* Left: Back Action */}
        <div className="w-48 flex items-center">
            {!isDashboard && (
                <button 
                    onClick={() => navigate('/app/dashboard')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 font-black text-sm hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                >
                    <ChevronLeft size={18} /> Back
                </button>
            )}
        </div>

        {/* Center: Title */}
        <div className="flex-1 flex justify-center">
            {getTitle() && (
                <div className="flex items-center gap-2.5 px-6 py-2 bg-emerald-50/50 rounded-full border border-emerald-100/50 shadow-inner">
                    <span className="text-xl">☘️</span>
                    <h1 className="text-xl font-black text-emerald-800 tracking-tight">{getTitle()}</h1>
                </div>
            )}
        </div>
        
        {/* Right: User Actions */}
        <div className="w-64 flex items-center justify-end gap-5">
          <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest hidden lg:block">v2.8</div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 cursor-help">
            <User size={18} className="text-blue-500" />
          </div>

          <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-xs font-bold text-gray-600">
            <Globe size={14} className="text-blue-400" />
            <span className="hidden sm:inline">Language:</span>
            <select className="bg-transparent outline-none border-none pr-4 cursor-pointer">
                <option>English</option>
                <option>Tamil</option>
            </select>
          </div>

          <button 
            onClick={handleLogout}
            className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <main className="flex-1 p-8 relative z-10 bg-gray-50/30">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;

