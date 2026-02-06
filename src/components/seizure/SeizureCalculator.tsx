import React, { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import type { SeizureLogistics } from '../../types';
import { parsePresentation } from '../../utils/PharmaParser';

interface SeizureCalculatorProps {
  onCalculate: (quantity: number, label: string, logistics: SeizureLogistics) => void;
  initialTotal?: number;
  cum?: string;
  presentation?: string;
  pharmaceuticalForm?: string;
  isVerified?: boolean;
}

export const SeizureCalculator: React.FC<SeizureCalculatorProps> = ({ 
  onCalculate, initialTotal = 0, cum, presentation = '', pharmaceuticalForm = '', isVerified 
}) => {
  const [packInput, setPackInput] = useState<number>(0);
  const [looseInput, setLooseInput] = useState<number>(initialTotal > 0 ? initialTotal : 0);
  
  const [model, setModel] = useState(parsePresentation(pharmaceuticalForm, presentation));

  // Reset si cambia el producto
  useEffect(() => {
      const newModel = parsePresentation(pharmaceuticalForm, presentation);
      setModel(newModel);
      setPackInput(0);
      setLooseInput(initialTotal > 0 ? initialTotal : 0);
  }, [presentation, pharmaceuticalForm, initialTotal]);

  // Cálculo
  useEffect(() => {
      const { packFactor, contentNet, mode, containerType, packType } = model;

      // 1. Total Legal
      const totalLegalUnits = (packInput * packFactor) + looseInput;

      // 2. Etiqueta Inteligente
      let smartLabel = `${totalLegalUnits} ${containerType}s`;
      if (packFactor > 1 && packInput > 0) {
          smartLabel = `${packInput} ${packType}s (${totalLegalUnits} ${containerType}s)`;
      } else if (mode === 'VOLUMETRIC') {
          smartLabel = `${totalLegalUnits} ${containerType}s`;
      }

      // 3. Logística (Volumen)
      let logisticVolume = 0;
      let displayVolume = 0;
      let displayUnit = model.contentUnit;

      if (mode !== 'DISCRETE' && contentNet > 0) {
          // Fórmula: (Cajas * Factor * ContenidoNeto) + (Sueltos * ContenidoNeto)
          // Simplificada: totalLegalUnits * contentNet
          logisticVolume = totalLegalUnits * contentNet;
          displayVolume = logisticVolume;
          
          if (displayUnit === 'mL' && displayVolume >= 1000) {
              displayVolume /= 1000;
              displayUnit = 'L';
          } else if (displayUnit === 'mg' && displayVolume >= 1000) {
              displayVolume /= 1000;
              displayUnit = 'g';
          }
      }

      const logistics: SeizureLogistics = {
          presentation: model,
          inputs: { packs: packInput, loose: looseInput },
          totals: {
              legalUnits: totalLegalUnits,
              logisticVolume: displayVolume,
              logisticUnit: displayUnit
          },
          calculationMethod: isVerified ? 'AUTO_CUM' : 'MANUAL_OVERRIDE'
      };

      onCalculate(totalLegalUnits, smartLabel, logistics);

  }, [packInput, looseInput, model, isVerified, onCalculate]);

  const theme = model.mode === 'VOLUMETRIC' ? 'cyan' : model.mode === 'MASS_BASED' ? 'amber' : 'indigo';

  return (
    <div className={`bg-white p-4 rounded-xl border-2 border-${theme}-100 shadow-sm animate-in fade-in`}>
        {/* HEADER */}
        <div className={`flex justify-between items-start mb-4 border-b border-${theme}-100 pb-3`}>
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <span className={`p-1.5 rounded-lg bg-${theme}-100 text-${theme}-700`}>
                        <Icon name={model.mode === 'VOLUMETRIC' ? 'droplet' : 'box'} size={16} />
                    </span>
                    <span className={`text-[10px] font-black text-${theme}-600 uppercase tracking-widest`}>
                        {model.mode === 'VOLUMETRIC' ? 'Líquido / Volumétrico' : 
                         model.mode === 'MASS_BASED' ? 'Masa / Semisólido' : 'Sólido / Unitario'}
                    </span>
                    {model.isConcentrationIrrelevant && (
                        <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            BIOLÓGICO
                        </span>
                    )}
                </div>
                <p className="text-xs font-bold text-slate-700">{model.detectedString}</p>
                {cum && <p className="text-[9px] text-slate-400 font-mono mt-0.5">ID REF: {cum}</p>}
            </div>
            <div className="text-right">
                <p className="text-[9px] text-slate-400 uppercase">Factor</p>
                <p className="text-lg font-black text-slate-800">x{model.packFactor}</p>
            </div>
        </div>

        {/* INPUTS */}
        <div className="grid grid-cols-12 gap-3 items-end mb-4">
            <div className="col-span-5">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block truncate">
                    {model.packType}s (x{model.packFactor})
                </label>
                <div className="relative">
                    <input 
                        type="number" min="0"
                        className={`w-full h-10 pl-3 pr-2 rounded-lg border border-slate-300 font-bold text-sm text-slate-700 focus:border-${theme}-500 outline-none transition-all`}
                        value={packInput || ''}
                        onChange={e => setPackInput(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                    />
                    <div className="absolute right-2 top-3 text-slate-300 pointer-events-none"><Icon name="box" size={14}/></div>
                </div>
            </div>

            <div className="col-span-2 flex justify-center pb-3 text-slate-300 font-black">+</div>

            <div className="col-span-5">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block truncate">
                    {model.containerType}s Sueltos
                </label>
                <div className="relative">
                    <input 
                        type="number" min="0"
                        className={`w-full h-10 pl-3 pr-2 rounded-lg border border-slate-300 font-bold text-sm text-slate-700 focus:border-${theme}-500 outline-none transition-all`}
                        value={looseInput || ''}
                        onChange={e => setLooseInput(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                    />
                    <div className="absolute right-2 top-3 text-slate-300 pointer-events-none">
                        <Icon name={model.mode === 'DISCRETE' ? 'circle' : 'droplet'} size={14}/>
                    </div>
                </div>
            </div>
        </div>

        {/* TOTALES */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
            <div>
                <p className="text-[9px] font-black text-slate-400 uppercase">Total Legal</p>
                <p className="text-xl font-black text-slate-800">
                    {((packInput * model.packFactor) + looseInput).toLocaleString('es-CO')} {model.containerType}s
                </p>
            </div>

            {/* TAREA 3: Eliminar Ruido Visual en Modo Discreto */}
            {/* Si es DISCRETE (Vial, Tableta), NO mostrar Volumen Total. */}
            {/* Si es MASS_BASED o VOLUMETRIC, mostrar volumen/masa si hay contentNet. */}
            {model.mode !== 'DISCRETE' && model.contentNet > 0 && (
                <div className="text-right border-l border-slate-200 pl-4">
                    <p className={`text-[9px] font-black text-${theme}-600 uppercase`}>
                        {model.mode === 'MASS_BASED' ? 'Masa Total' : 'Volumen Total'}
                    </p>
                    <p className={`text-xl font-black text-${theme}-700`}>
                        {(((packInput * model.packFactor) + looseInput) * model.contentNet / (model.contentUnit === 'mL' && ((packInput * model.packFactor) + looseInput) * model.contentNet >= 1000 ? 1000 : 1)).toLocaleString('es-CO', { maximumFractionDigits: 2 })}
                        <span className="text-xs ml-1">{((packInput * model.packFactor) + looseInput) * model.contentNet >= 1000 && model.contentUnit === 'mL' ? 'L' : model.contentUnit}</span>
                    </p>
                </div>
            )}

            {/* TAREA 3: Mostrar Masa Estimada Opcional para Sólidos si aplica */}
            {model.mode === 'DISCRETE' && model.contentNet > 0 && ['mg', 'g'].includes(model.contentUnit) && (
                 <div className="text-right border-l border-slate-200 pl-4 opacity-50">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Masa Neta (Est.)</p>
                    <p className="text-sm font-bold text-slate-500">
                        {(((packInput * model.packFactor) + looseInput) * model.contentNet).toLocaleString('es-CO')} {model.contentUnit}
                    </p>
                 </div>
            )}
        </div>
    </div>
  );
};
