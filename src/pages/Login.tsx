import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { useToast } from '../context/ToastContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, user } = useAuthStore();
  const { showToast } = useToast();
  
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  useEffect(() => {
    const savedUser = localStorage.getItem('vigi_remember_user');
    if (savedUser) {
      setUsername(savedUser);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (rememberMe) {
      localStorage.setItem('vigi_remember_user', username.toUpperCase());
    } else {
      localStorage.removeItem('vigi_remember_user');
    }

    try {
      // Simulación de delay para feedback visual
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 1. CAPTURAMOS EL OBJETO COMPLETO
      const result = await login(username, pin);
      
      // 2. VERIFICAMOS LA PROPIEDAD BOOLEANA EXPLÍCITA
      if (result.success) {
        showToast(`Bienvenido, ${username}`, 'success');
        navigate('/dashboard');
      } else {
        // 3. MANEJO DE ERROR EXACTO
        const msg = result.message || 'Credenciales no válidas.';
        setError(msg);
        // Usamos 'error' para que el toast sea ROJO, no verde ni amarillo
        showToast(msg, "error"); 
      }
    } catch (err) {
      showToast("Error de conexión con la base de datos.", "error");
      setError('Error técnico. Contacte a soporte.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans bg-white overflow-hidden">
      
      {/* PANEL IZQUIERDO - BRANDING INSTITUCIONAL */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative items-center justify-center overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-teal-800/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[100px]"></div>
        
        <div className="relative z-10 p-12 text-center max-w-lg">
          <div className="mb-8 inline-flex p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl">
            <Icon name="activity" size={64} className="text-teal-400" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-4 drop-shadow-md">
            VigiSalud Atlántico
          </h1>
          <p className="text-lg text-slate-300 font-normal leading-relaxed">
            Sistema de Información para Inspección, Vigilancia y Control Sanitario (IVC)
          </p>
          <div className="mt-12 border-t border-white/10 pt-6">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
              Secretaría de Salud Departamental
            </p>
          </div>
        </div>
      </div>

      {/* PANEL DERECHO - FORMULARIO */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 bg-slate-50 relative">
        <div className="w-full max-w-md bg-white p-10 rounded-xl shadow-lg border border-slate-200 flex flex-col justify-center">
          
          <div className="mb-8 border-b border-slate-100 pb-4">
            <h2 className="text-2xl font-bold text-slate-800 text-center lg:text-left">
              Ingreso de Funcionarios
            </h2>
            <p className="text-sm text-slate-500 mt-1 text-center lg:text-left">
              Acceso exclusivo para personal autorizado IVC.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 w-full">
            <div className="space-y-4">
              <Input
                label="Usuario / Funcionario"
                placeholder="EJ: JPEREZ"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="uppercase"
                autoFocus
              />
              
              <Input
                label="Clave de Acceso"
                type="password"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={4}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-700 animate-in slide-in-from-top-2">
                <Icon name="alert-triangle" size={18} />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2 py-2">
              <input 
                type="checkbox" 
                id="rememberMe" 
                className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="rememberMe" className="text-sm text-slate-600">
                Recordar usuario en este equipo
              </label>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-sm font-bold shadow-md bg-slate-900 hover:bg-slate-800" 
              isLoading={isLoading}
            >
              INICIAR SESIÓN
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
              El uso indebido de este sistema puede acarrear sanciones disciplinarias y penales (Ley 1273 de 2009).
            </p>
          </div>
        </div>

        <div className="mt-8 text-center lg:text-left w-full max-w-md flex justify-between items-center text-xs text-slate-400">
            <span>Versión 7.0 (Build 2026)</span>
            <span className="flex items-center gap-1"><Icon name="shield" size={12}/> Datos Protegidos</span>
        </div>
      </div>
    </div>
  );
};