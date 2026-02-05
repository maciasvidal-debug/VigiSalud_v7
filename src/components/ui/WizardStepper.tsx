import React from 'react';
import { Icon } from './Icon';

// CORRECCIÓN: Definición local para desacoplar de Icon.tsx
// Esto soluciona el error TS2305 manteniendo el tipado estricto en el componente.
export type IconName = string;

export interface StepItem {
  id: string | number;
  label: string;
  icon?: IconName;
  description?: string;
  disabled?: boolean;
}

interface WizardStepperProps {
  steps: StepItem[];
  currentStep: string | number;
  onStepClick?: (stepId: any) => void;
  className?: string;
}

export const WizardStepper: React.FC<WizardStepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  className = ''
}) => {
  // Encontrar el índice actual para calcular la barra de progreso
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  const progressPercent = (currentIndex / (steps.length - 1)) * 100;

  return (
    <div className={`w-full ${className}`}>
      <div className="relative flex justify-between items-start">
        
        {/* LÍNEA BASE (Gris) */}
        <div className="absolute top-5 left-0 w-full h-1 bg-surface-border rounded-full -z-0"></div>
        
        {/* LÍNEA DE PROGRESO (Marca) */}
        <div 
          className="absolute top-5 left-0 h-1 bg-brand rounded-full transition-all duration-500 ease-out -z-0"
          style={{ width: `${progressPercent}%` }}
        ></div>

        {/* ITEMS DEL STEPPER */}
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = index < currentIndex;
          const isClickable = onStepClick && !step.disabled;

          return (
            <div 
              key={step.id} 
              className={`relative z-10 flex flex-col items-center group ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => isClickable && onStepClick(step.id)}
              style={{ width: `${100 / steps.length}%` }} 
            >
              {/* CÍRCULO INDICADOR */}
              <div 
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-sm
                  ${isActive 
                    ? 'bg-brand border-brand text-white scale-110 shadow-glow ring-4 ring-surface-card' 
                    : isCompleted 
                      ? 'bg-brand-light border-brand text-brand-dark' 
                      : 'bg-surface-card border-surface-border text-content-tertiary'
                  }
                  ${step.disabled ? 'opacity-50 grayscale' : 'hover:scale-105'}
                `}
              >
                {isCompleted ? (
                  <Icon name={step.icon as any || 'check'} size={18} className="stroke-[3]" />
                ) : (
                  step.icon ? <Icon name={step.icon as any} size={18} /> : <span className="font-bold text-sm">{index + 1}</span>
                )}
              </div>

              {/* ETIQUETAS DE TEXTO */}
              <div className="mt-3 text-center flex flex-col items-center transition-all duration-300">
                <span 
                  className={`text-xs font-bold uppercase tracking-wide transition-colors duration-300
                    ${isActive ? 'text-brand-deep' : isCompleted ? 'text-brand' : 'text-content-tertiary'}
                  `}
                >
                  {step.label}
                </span>
                
                {/* Descripción (visible en escritorio) */}
                {step.description && (
                  <span className={`text-[10px] font-medium hidden sm:block mt-0.5 
                    ${isActive ? 'text-content-secondary' : 'text-content-tertiary'}`}>
                    {step.description}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};