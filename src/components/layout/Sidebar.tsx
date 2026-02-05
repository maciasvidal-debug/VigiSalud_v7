import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { Icon } from '../ui/Icon';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    // CAMBIO AQUÍ: "Dashboard" -> "Sala Situacional"
    { label: 'Sala Situacional', icon: 'grid', to: '/dashboard', roles: ['ADMIN', 'DIRECTOR', 'INSPECTOR'] },
    { label: 'Censo y Vigilados', icon: 'store', to: '/dashboard/census', roles: ['ADMIN', 'DIRECTOR', 'INSPECTOR'] },
    { label: 'Historial Actuaciones', icon: 'clipboard-list', to: '/dashboard/inspections', roles: ['ADMIN', 'DIRECTOR', 'INSPECTOR'] },
    { label: 'Gestión de Equipo', icon: 'users', to: '/dashboard/team', roles: ['ADMIN', 'DIRECTOR'] },
    { label: 'Mantenimiento', icon: 'settings', to: '/dashboard/maintenance', roles: ['ADMIN', 'DIRECTOR'] },
    { label: 'Ayuda y Recursos', icon: 'book-open', to: '/dashboard/resources', roles: ['ADMIN', 'DIRECTOR', 'INSPECTOR'] },
  ];

  const allowedItems = user ? menuItems.filter(item => item.roles.includes(user.role || '')) : [];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-2xl z-50">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="bg-teal-500 p-2 rounded-lg shadow-lg shadow-teal-500/20">
          <Icon name="activity" size={24} className="text-white" />
        </div>
        <div>
          <h1 className="font-black text-xl tracking-tight leading-none">VigiSalud</h1>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Control Sanitario</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <div className="text-xs font-bold text-slate-500 uppercase px-4 mb-2 tracking-wider">Módulos</div>
        {allowedItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'} 
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                isActive 
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/50 translate-x-1' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'
              }`
            }
          >
            <Icon name={item.icon as any} size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-950/30">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 font-bold text-teal-500">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-500 truncate capitalize font-bold bg-slate-800 px-1.5 py-0.5 rounded w-fit mt-0.5">
              {user?.role?.toLowerCase()}
            </p>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition-colors group">
          <Icon name="log-out" size={18} className="group-hover:-translate-x-1 transition-transform"/>
          <span className="text-sm font-bold">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
};