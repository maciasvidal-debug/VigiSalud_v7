import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { Icon } from '../ui/Icon';

export const Header: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-8 py-4 shadow-sm flex justify-end items-center transition-all">
      {/* Solo información del usuario y logout */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {user?.role || 'INVITADO'}
            </div>
            <div className="text-sm font-bold text-slate-700">
              {user?.name || 'Funcionario'}
            </div>
          </div>
          
          <div className="w-9 h-9 bg-teal-50 rounded-full flex items-center justify-center text-teal-600 font-bold border border-teal-100 shadow-sm">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>

        <button 
          onClick={logout}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          title="Cerrar Sesión"
        >
          <Icon name="log-out" size={18} />
        </button>
      </div>
    </header>
  );
};
