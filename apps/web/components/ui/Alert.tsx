import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface AlertProps {
  type: 'error' | 'success';
  message: string;
}

export const Alert: React.FC<AlertProps> = ({ type, message }) => {
  const isError = type === 'error';
  return (
    <div role="alert" className={`flex items-start gap-3 p-4 rounded-xl shadow-sm mb-6 ${
      isError ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'
    }`}>
      {isError ? (
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
      )}
      <p className="text-sm font-medium leading-relaxed">{message}</p>
    </div>
  );
};
