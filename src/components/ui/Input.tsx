import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block mb-1.5 text-xs font-bold text-content-secondary uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full h-12 px-4 
            bg-white border border-surface-border rounded-xl 
            text-content-primary font-medium placeholder:text-content-tertiary
            outline-none transition-all duration-200
            focus:border-brand focus:ring-4 focus:ring-brand/10
            disabled:bg-surface-ground disabled:text-content-tertiary disabled:cursor-not-allowed
            ${error ? 'border-status-error focus:border-status-error focus:ring-status-error/10' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs font-bold text-status-error animate-pulse">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';