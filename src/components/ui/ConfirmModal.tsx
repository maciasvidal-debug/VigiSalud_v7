import React from 'react';
import { Icon } from './Icon';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen, title, message, onConfirm, onCancel, 
  confirmText = "Confirmar", cancelText = "Cancelar", type = 'danger'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
        <div className={`p-6 text-center ${type === 'danger' ? 'bg-red-50' : 'bg-blue-50'} border-b ${type === 'danger' ? 'border-red-100' : 'border-blue-100'}`}>
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            <Icon name={type === 'danger' ? 'alert-triangle' : 'info'} size={32} />
          </div>
          <h3 className={`text-xl font-black ${type === 'danger' ? 'text-red-900' : 'text-blue-900'}`}>{title}</h3>
        </div>
        
        <div className="p-6 text-center">
          <p className="text-slate-600 text-sm font-medium leading-relaxed">{message}</p>
        </div>

        <div className="p-4 bg-slate-50 flex gap-3 border-t border-slate-100">
          <button onClick={onCancel} className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm">
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 text-sm ${
              type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};