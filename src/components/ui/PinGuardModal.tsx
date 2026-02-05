import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { db } from '../../db';
import { Icon } from './Icon';
import { verifyPin } from '../../utils/security'; // <--- IMPORT NUEVO

interface PinGuardModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const PinGuardModal: React.FC<PinGuardModalProps> = ({ isOpen, title, message, onSuccess, onClose }) => {
  const { user } = useAuthStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Bloquear scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (user?.id) {
        // Obtenemos el usuario "fresco" de la BD para tener acceso al hash del PIN
        // (recuerda que en el store en memoria lo habíamos borrado por seguridad)
        const official = await db.officials.get(user.id);
        
        if (official) {
          // VALIDACIÓN CRIPTOGRÁFICA
          const isValid = await verifyPin(pin, official.pin);
          
          if (isValid) {
            setTimeout(() => {
              onSuccess();
              setPin('');
              onClose();
            }, 300);
          } else {
            setError('PIN Incorrecto');
            setPin('');
          }
        } else {
          setError('Error de usuario');
        }
      } else {
        setError('Error de sesión');
      }
    } catch (err) {
      setError('Error de validación');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      
      {/* 1. GLASSMORPHISM BACKDROP */}
      <div 
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-md transition-opacity duration-500 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 2. TARJETA PROFESIONAL */}
      <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl shadow-teal-900/20 overflow-hidden transform transition-all animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 border border-white/60">
        
        {/* Barra de Marca Superior */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-teal-400 to-teal-600" />

        {/* Botón Cerrar */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-full transition-colors z-20"
        >
          <Icon name="x" size={18} />
        </button>

        <div className="pt-10 pb-4 px-8 flex flex-col items-center text-center">
          {/* Icono Corporativo */}
          <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600 mb-4 shadow-sm border border-teal-100 ring-4 ring-teal-50/50">
            <Icon name="lock" size={28} strokeWidth={2.5} />
          </div>
          
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">
            {title}
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Zona de Seguridad
          </p>
        </div>

        <div className="px-8 pb-8 space-y-6">
          
          <div className="bg-amber-50/80 border border-amber-100 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm">
            <div className="text-amber-500 p-1.5 bg-white rounded-full shadow-sm"><Icon name="alert-triangle" size={20}/></div>
            <p className="text-xs text-amber-800 font-medium leading-relaxed text-center px-2">
              {message || "Esta acción requiere privilegios elevados. Por favor, confirme su identidad para continuar."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block text-center">
                Ingrese PIN (4 Dígitos)
              </label>
              <div className="relative">
                {/* Input estilo "Caja Fuerte" */}
                <input
                  type="password"
                  autoFocus
                  maxLength={4}
                  placeholder="••••"
                  className="w-full text-center text-3xl font-black tracking-[0.5em] py-4 bg-slate-50 rounded-xl text-slate-800 outline-none border border-slate-200 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 transition-all placeholder:text-slate-300"
                  value={pin}
                  onChange={(e) => {
                    setError('');
                    setPin(e.target.value.replace(/\D/g, ''));
                  }}
                />
              </div>
            </div>

            {/* Mensaje de Error */}
            {error && (
              <div className="flex justify-center animate-pulse">
                <span className="text-xs font-bold text-red-500 flex items-center gap-1.5 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                  <Icon name="x-circle" size={14} /> {error}
                </span>
              </div>
            )}

            {/* Botonera Dividida */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="py-3 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pin.length < 4 || loading}
                className="py-3 text-xs font-bold bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-600/20 hover:shadow-teal-600/30 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? 'Verificando...' : <>Autorizar <Icon name="arrow-right" size={14}/></>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};