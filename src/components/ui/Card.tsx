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
    <div className={`bg-surface-card rounded-xl shadow-soft border border-surface-border overflow-hidden ${className}`}>
      {(title || icon || actions) && (
        <div className="px-6 py-4 border-b border-surface-border flex justify-between items-center bg-surface-ground/50">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-2 bg-brand-light text-brand-deep rounded-lg">
                <Icon name={icon} size={18} strokeWidth={2.5} />
              </div>
            )}
            {title && (
              <h3 className="font-black text-content-primary text-xs uppercase tracking-widest">
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
