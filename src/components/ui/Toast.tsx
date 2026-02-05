import React, { useEffect } from 'react';
import { Icon } from './Icon';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000); 
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    error: 'bg-red-50 text-red-900 border-red-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-200',
    info: 'bg-blue-50 text-blue-900 border-blue-200',
  };

  const icons = {
    success: 'check-circle',
    error: 'alert-triangle',
    warning: 'alert-octagon',
    info: 'info',
  };

  return (
    <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl animate-fade-in ${styles[type]} max-w-sm`}>
      <div className="shrink-0"><Icon name={icons[type] as any} size={20} /></div>
      <p className="text-sm font-bold pr-2 leading-tight">{message}</p>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 p-1">
        <Icon name="x" size={14} />
      </button>
    </div>
  );
};