import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
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
  
  const baseStyles = "vigi-force-visible inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20";
  
  const variants = {
    primary: "bg-brand text-white hover:bg-brand-dark shadow-lg shadow-brand/20 border border-transparent",
    secondary: "bg-white text-content-secondary border border-surface-border hover:bg-surface-hover hover:text-content-primary shadow-sm",
    danger: "bg-status-error text-white hover:bg-red-700 shadow-md shadow-status-error/20 border border-transparent",
    ghost: "bg-transparent text-content-secondary hover:bg-surface-hover hover:text-brand-dark border-transparent"
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
