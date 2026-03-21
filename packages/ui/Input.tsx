import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        <div className="relative">
          <input
            ref={ref}
            className={`w-full px-4 py-2.5 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all ${
              error ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'
            } ${icon ? 'pr-10' : ''} ${className}`}
            {...props}
          />
          {icon && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400">
              {icon}
            </div>
          )}
        </div>
        {error && <span className="text-xs font-medium text-red-500 mt-0.5">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
