import React, { useState, type MouseEvent, useEffect } from 'react';
import { createPortal } from 'react-dom'; // <--- 1. IMPORTAR PORTAL
import { Icon } from './Icon';
import type { User } from '../../types';

interface DigitalIDCardProps {
  user: User;
  onClose: () => void;
}

export const DigitalIDCard: React.FC<DigitalIDCardProps> = ({ user, onClose }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  // Bloquear scroll del body cuando el carnet está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  // Efecto Holográfico: Calcula la posición del brillo según el mouse
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  // 2. USAR PORTAL PARA ESCAPAR DEL CONTENEDOR PADRE
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl p-4 animate-fade-in print:bg-white print:p-0">
      
      {/* Controles Superiores */}
      <div className="absolute top-6 right-6 flex gap-3 print:hidden z-50">
        <button 
          onClick={() => window.print()} 
          className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md border border-white/20 shadow-lg hover:scale-105 active:scale-95" 
          title="Imprimir Carnet Oficial"
        >
          <Icon name="printer" size={20} />
        </button>
        <button 
          onClick={onClose} 
          className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md border border-white/20 shadow-lg hover:scale-105 active:scale-95"
        >
          <Icon name="x" size={20} />
        </button>
      </div>

      <div className="relative perspective-1000">
        
        {/* CONTENEDOR 3D DE LA TARJETA */}
        <div 
          className={`relative w-[340px] h-[540px] transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''} print:w-[86mm] print:h-[54mm] print:[transform:none] print:shadow-none`}
          onMouseMove={handleMouseMove}
        >
          
          {/* --- CARA FRONTAL (Con Holograma) --- */}
          <div className="absolute inset-0 bg-white rounded-3xl shadow-2xl overflow-hidden [backface-visibility:hidden] border border-white/40 print:rounded-none print:border-black">
            
            {/* CAPA HOLOGRÁFICA DE SEGURIDAD (Interactiva) */}
            <div 
              className="absolute inset-0 z-20 pointer-events-none opacity-40 mix-blend-color-dodge print:hidden"
              style={{
                background: `linear-gradient(115deg, transparent 40%, rgba(0, 255, 255, 0.6) 45%, rgba(255, 0, 255, 0.6) 50%, transparent 55%) ${mousePos.x}% ${mousePos.y}% / 250% 250% no-repeat`
              }}
            />

            {/* Header Oficial */}
            <div className="h-32 bg-slate-900 relative p-6 flex flex-col items-center justify-center text-center print:h-16 print:p-2">
               <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
               <h3 className="text-white font-black tracking-widest text-lg print:text-xs">REPÚBLICA DE COLOMBIA</h3>
               <p className="text-teal-400 text-xs font-bold uppercase tracking-wider mt-1 print:text-[8px]">Autoridad Sanitaria Departamental</p>
               
               {/* Escudo sutil de fondo */}
               <div className="absolute top-2 right-2 opacity-10">
                 <Icon name="shield" size={40} className="text-white"/>
               </div>
            </div>

            {/* Foto y Datos */}
            <div className="flex flex-col items-center mt-[-40px] print:mt-[-20px] relative z-10">
               {/* CONTENEDOR DE FOTO */}
               <div className="w-32 h-32 rounded-full border-4 border-white bg-slate-200 shadow-lg flex items-center justify-center overflow-hidden print:w-20 print:h-20 bg-cover bg-center">
                 {user.photo ? (
                   <img src={user.photo} className="w-full h-full object-cover" alt={`Foto de ${user.name}`} />
                 ) : (
                   <Icon name="user" size={48} className="text-slate-400"/>
                 )}
               </div>
               
               <div className="text-center mt-4 print:mt-2 px-2">
                 <h2 className="text-xl font-black text-slate-800 leading-tight uppercase print:text-sm">{user.name}</h2>
                 <div className="flex flex-col items-center gap-1 mt-2">
                   <span className="inline-block bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-xs font-bold border border-teal-100 print:text-[10px] print:py-0 print:border-none">
                     {user.cargo?.toUpperCase() || 'FUNCIONARIO'}
                   </span>
                   {/* Badge de Verificación Visual */}
                   <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full print:hidden">
                     <Icon name="check-circle" size={10}/> ACTIVO
                   </span>
                 </div>
               </div>
            </div>

            {/* Footer Frontal */}
            <div className="absolute bottom-0 w-full p-6 text-center print:p-2">
               <div className="border-t border-slate-100 pt-4 print:pt-2 grid grid-cols-2 gap-4 text-left">
                 <div>
                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Identificación</p>
                   <p className="text-sm font-mono font-bold text-slate-700 print:text-xs">{user.identification}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Grupo Sanguíneo</p>
                   <p className="text-sm font-bold text-red-600 print:text-[8px]">{user.rh}</p>
                 </div>
               </div>
               <div className="mt-4 pt-2 border-t border-slate-50 text-[8px] text-slate-300 font-mono tracking-wider print:hidden">
                 TOKEN DE SEGURIDAD: {Math.random().toString(36).substring(7).toUpperCase()}
               </div>
            </div>
          </div>

          {/* --- CARA TRASERA --- */}
          <div className="absolute inset-0 bg-slate-50 rounded-3xl shadow-2xl overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)] border border-white/40 flex flex-col p-8 print:hidden">
            <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest mb-6 text-center">Información Legal</h3>
            
            <div className="space-y-4 flex-1">
               <div className="flex justify-between border-b border-slate-200 pb-2">
                 <span className="text-xs text-slate-500">Vigencia Contrato:</span>
                 <span className="text-xs font-bold text-slate-800">{user.contractDateEnd || 'INDEFINIDA'}</span>
               </div>
               <div className="flex justify-between border-b border-slate-200 pb-2">
                 <span className="text-xs text-slate-500">TP / Registro:</span>
                 <span className="text-xs font-bold text-slate-800">{user.tp || 'N/A'}</span>
               </div>
               <div className="flex justify-between border-b border-slate-200 pb-2">
                 <span className="text-xs text-slate-500">Vinculación:</span>
                 <span className="text-xs font-bold text-slate-800 text-right max-w-[150px] truncate">{user.contractType?.split('(')[0]}</span>
               </div>
               <div className="flex justify-between border-b border-slate-200 pb-2">
                 <span className="text-xs text-slate-500">Resolución/Contrato:</span>
                 <span className="text-xs font-bold text-slate-800">{user.contractNumber || 'N/A'}</span>
               </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-2 mt-auto">
               <div className="w-24 h-24 bg-white p-2 rounded-lg border border-slate-200 shadow-inner">
                 <img 
                   src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VIGISALUD:${user.id}:${user.identification}:VALID`} 
                   alt="QR Verificación" 
                   className="w-full h-full opacity-90 mix-blend-multiply"
                 />
               </div>
               <p className="text-[10px] text-slate-400 text-center leading-tight">Escanee para verificar autenticidad ante la entidad.</p>
            </div>
          </div>
        </div>

        {/* 2. BOTÓN DE GIRO EXPLÍCITO */}
        <div className="flex justify-center mt-8 print:hidden">
          <button 
            onClick={() => setIsFlipped(!isFlipped)}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full text-white font-bold text-sm transition-all shadow-xl group hover:scale-105 active:scale-95"
          >
            <Icon name="refresh-cw" size={16} className={`transition-transform duration-500 ${isFlipped ? '-rotate-180' : ''}`}/>
            {isFlipped ? 'Ver Frontal' : 'Ver Reverso'}
          </button>
        </div>

      </div>
    </div>,
    document.body // <--- AQUÍ OCURRE LA MAGIA DEL PORTAL
  );
};