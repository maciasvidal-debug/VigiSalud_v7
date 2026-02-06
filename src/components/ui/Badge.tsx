import React from 'react';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ 
  label, 
  variant = 'neutral',
  className = ''
}) => {
  
  const variants = {
    success: "bg-status-successBg text-emerald-800 border border-status-success/30",
    warning: "bg-status-warningBg text-amber-800 border border-status-warning/30",
    danger: "bg-status-errorBg text-red-800 border border-status-error/30",
    info: "bg-status-infoBg text-blue-800 border border-status-info/30",
    neutral: "bg-surface-hover text-content-secondary border border-surface-border",
  };

  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${variants[variant]} ${className}`}>
      {label}
    </span>
  );
};
