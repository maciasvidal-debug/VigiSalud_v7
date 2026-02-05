import React from 'react';
import { Icon } from './Icon';

interface CardProps {
  title?: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ 
  title, 
  icon, 
  children, 
  className = '', 
  actions 
}) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden ${className}`}>
      {(title || icon || actions) && (
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-2 bg-teal-50 text-teal-700 rounded-lg">
                <Icon name={icon} size={18} strokeWidth={2.5} />
              </div>
            )}
            {title && (
              <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">
                {title}
              </h3>
            )}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};
