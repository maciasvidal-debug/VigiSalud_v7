import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary',
  isLoading = false, 
  className = '', 
  children, 
  disabled, 
  ...props 
}) => {
  
  // Se integra 'vigi-force-visible' para anular cualquier opacidad externa
  const baseStyles = "vigi-force-visible items-center justify-center gap-2 h-11 px-6 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-teal-600 text-white hover:bg-teal-700 border border-teal-800/20",
    secondary: "bg-slate-200 border-2 border-slate-400 text-slate-900 hover:bg-slate-300",
    danger: "bg-red-600 text-white border border-red-800"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading && <Loader2 className="animate-spin" size={18} />}
      {children}
    </button>
  );
};