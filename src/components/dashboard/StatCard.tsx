import React from 'react';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  trend?: string; 
  color?: 'teal' | 'blue' | 'red' | 'orange' | 'slate';
}

export const StatCard: React.FC<StatCardProps> = ({ 
  label, 
  value, 
  icon, 
  trend, 
  color = 'teal' 
}) => {
  
  const colorStyles = {
    teal: { border: 'border-l-teal-500', iconBg: 'bg-teal-50', iconText: 'text-teal-600' },
    blue: { border: 'border-l-blue-500', iconBg: 'bg-blue-50', iconText: 'text-blue-600' },
    red: { border: 'border-l-red-500', iconBg: 'bg-red-50', iconText: 'text-red-600' },
    orange: { border: 'border-l-orange-500', iconBg: 'bg-orange-50', iconText: 'text-orange-600' },
    slate: { border: 'border-l-slate-500', iconBg: 'bg-slate-50', iconText: 'text-slate-600' },
  };

  const currentStyle = colorStyles[color] || colorStyles.teal;

  return (
    // 'h-full' es CRÍTICO para que llene el contenedor h-32 definido en el Grid
    <Card className={`h-full border-l-4 ${currentStyle.border} shadow-sm transition-transform hover:-translate-y-1 duration-300 flex flex-col justify-center`}>
      <div className="flex items-start justify-between w-full h-full">
        <div className="flex flex-col justify-between h-full py-1">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 truncate">
              {label}
            </p>
            <h3 className="text-3xl font-black text-slate-800 leading-none tracking-tight">
              {value}
            </h3>
          </div>
          
          {trend && (
            <span className="inline-block mt-auto text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full w-fit">
              {trend} vs mes anterior
            </span>
          )}
        </div>
        
        <div className={`flex-shrink-0 p-3 rounded-2xl ${currentStyle.iconBg} ${currentStyle.iconText} shadow-sm ml-4`}>
          <Icon name={icon as any} size={24} strokeWidth={2.5} />
        </div>
      </div>
    </Card>
  );
};