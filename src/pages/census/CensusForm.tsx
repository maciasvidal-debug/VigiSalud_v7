import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../context/ToastContext'; 
import type { Establishment, CategoryType, DocumentType, EstablishmentStatus } from '../../types';

const ATLANTICO_DATA = [
  { name: "BARRANQUILLA", dane: "08001", lat: 10.9685, lng: -74.7813 },
  { name: "SOLEDAD", dane: "08758", lat: 10.9184, lng: -74.7646 },
  { name: "MALAMBO", dane: "08433", lat: 10.8583, lng: -74.7739 },
  { name: "SABANALARGA", dane: "08638", lat: 10.6333, lng: -74.9167 },
  { name: "GALAPA", dane: "08296", lat: 10.9184, lng: -74.8333 },
];

const SUBTYPES: any = {
  FORMAL: ["DROGUERÍA", "FARMACIA-DROGUERÍA", "DEPÓSITO DE DROGAS", "TIENDA NATURISTA", "OTROS"],
  INFORMAL: ["TIENDA DE BARRIO", "MISCELÁNEA", "RESTAURANTE", "PANADERÍA", "OTROS"],
  AMBULANTE: ["PUESTO DE ALIMENTOS", "VENTA DE ACCESORIOS", "FRUTAS/VERDURAS", "OTROS"]
};
const MOBILE_UNITS = ["CARRITO", "CARRETILLA", "BANDEJA", "ESTACIONARIO", "OTROS"];

export const CensusForm: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast(); 
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<CategoryType>("FORMAL");
  
  // Estado para el modal de espejo
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState({
    idType: 'NIT' as DocumentType,
    nit: '',
    name: '',
    commercialName: '',
    type: '', 
    typeOther: '',
    address: '',
    city: '', 
    responsibleName: '',
    responsibleId: '',
    techDirectorName: '',
    techDirectorId: '',
    techDirectorTp: '',
    mobileUnitType: '', 
    mobileUnitOther: '',
    sector: '',
    emailJudicial: '',
    phone: '',
    status: 'ACTIVO' as EstablishmentStatus
  });

  useEffect(() => {
    setFormData(prev => ({ 
      ...prev, 
      idType: category === "FORMAL" ? 'NIT' : 'CC', 
      type: '', 
      mobileUnitType: '' 
    }));
  }, [category]);

  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const val = e.target.value.replace(/\D/g, ''); 
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  // --- VALIDACIÓN DE RESPONSABLE (PREVENCIÓN) ---
  const handleResponsibleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setFormData(prev => ({ ...prev, responsibleName: val }));
    
    // Si detectamos "SAS" o "LTDA", avisamos inmediatamente (sin bloquear, por si acaso)
    if (/\b(SAS|LTDA|S\.A)\b/.test(val)) {
       // Podríamos mostrar un toast o un warning visual
       // Por ahora, confiamos en el label claro, pero el backend/wizard lo manejará
    }
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.type) {
      showToast("Debe seleccionar la Actividad Económica.", "warning");
      return;
    }
    if (!formData.city) {
      showToast("Debe seleccionar el Municipio.", "warning");
      return;
    }
    if (category === "AMBULANTE" && !formData.mobileUnitType) {
      showToast("Debe seleccionar el Tipo de Unidad.", "warning");
      return;
    }
    if (!formData.nit || !formData.name) {
      showToast("Los campos de identificación son obligatorios.", "error");
      return;
    }
    
    // Validación Fuerte antes de guardar
    if (/\b(SAS|LTDA|S\.A)\b/i.test(formData.responsibleName)) {
       if(!confirm("⚠️ ADVERTENCIA: Ha ingresado una empresa (SAS/LTDA) en el nombre del Responsable Legal. \n\nEste campo debe contener el nombre de la PERSONA NATURAL (humano) representante. ¿Desea continuar de todos modos?")) {
         return;
       }
    }

    setShowPreview(true);
  };

  const confirmSave = async () => {
    setLoading(true);
    const geo = ATLANTICO_DATA.find(m => m.name === formData.city);

    try {
      const sanitized: Establishment = {
        category,
        idType: formData.idType,
        nit: formData.nit.trim().toUpperCase(),
        name: formData.name.trim().toUpperCase(),
        commercialName: formData.commercialName.trim().toUpperCase(),
        type: formData.type === "OTROS" ? formData.typeOther.toUpperCase() : formData.type,
        city: formData.city,
        daneCode: geo?.dane || "08001",
        lat: geo?.lat,
        lng: geo?.lng,
        address: category === "AMBULANTE" ? `SECTOR: ${formData.sector}` : formData.address.trim().toUpperCase(),
        phone: formData.phone.trim(),
        status: formData.status,
        responsibleName: formData.responsibleName.trim().toUpperCase(),
        responsibleId: formData.responsibleId.trim(),
        emailJudicial: formData.emailJudicial.trim().toLowerCase(),
        techDirectorName: formData.techDirectorName.trim().toUpperCase(),
        techDirectorId: formData.techDirectorId.trim(),
        techDirectorTp: formData.techDirectorTp.trim().toUpperCase(),
        mobileUnitType: formData.mobileUnitType === "OTROS" ? formData.mobileUnitOther.toUpperCase() : formData.mobileUnitType,
        sector: category === "AMBULANTE" ? formData.sector.trim().toUpperCase() : ''
      };

      await db.establishments.add(sanitized);
      
      showToast("Establecimiento registrado correctamente.", "success");
      navigate('/dashboard/census');
    } catch (err) {
      showToast("Error al guardar. Verifique si el NIT/ID ya existe.", "error");
      setShowPreview(false);
    } finally {
      setLoading(false);
    }
  };

  const selectCls = "w-full h-11 px-4 rounded-xl border border-surface-border bg-white font-bold text-content-primary outline-none focus:border-brand appearance-none transition-all invalid:text-content-tertiary";

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      <header className="border-b border-surface-border pb-6">
        <h1 className="text-3xl font-black text-content-primary tracking-tight">Registro de Vigilado</h1>
        <div className="flex gap-3 mt-6">
          {(["FORMAL", "INFORMAL", "AMBULANTE"] as CategoryType[]).map((cat) => (
            <button key={cat} type="button" onClick={() => setCategory(cat)}
              className={`px-8 py-3 rounded-2xl font-black text-xs tracking-widest transition-all ${category === cat ? "bg-brand text-white shadow-xl translate-y-[-2px]" : "bg-white text-content-tertiary border-2 border-surface-border"}`}>
              {cat}
            </button>
          ))}
        </div>
      </header>

      <form onSubmit={handlePreSubmit} className="space-y-6">
        <Card title={`Identificación - ${category}`} icon="id-card">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actividad Económica</label>
              <select 
                className={selectCls} 
                value={formData.type} 
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                required
              >
                <option value="" disabled>Seleccione el tipo de establecimiento...</option>
                {SUBTYPES[category].map((t: string) => <option key={t} value={t}>{t}</option>)}
              </select>
              {formData.type === "OTROS" && (
                <div className="mt-2">
                   <Input label="Especifique la Actividad" required value={formData.typeOther} onChange={(e) => setFormData({...formData, typeOther: e.target.value})} />
                </div>
              )}
            </div>

            <Input label={category === "FORMAL" ? "Razón Social" : "Nombre del Propietario"} required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            <Input label={category === "AMBULANTE" ? "Denominación del Puesto" : "Nombre Comercial / Fantasía"} value={formData.commercialName} onChange={(e) => setFormData({...formData, commercialName: e.target.value})} />

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo Documento</label>
              <select className={selectCls} value={formData.idType} onChange={(e) => setFormData({...formData, idType: e.target.value as DocumentType})} disabled={category === "FORMAL"}>
                {category === "FORMAL" ? <option value="NIT">NIT</option> : <><option value="CC">Cédula Ciudadanía</option><option value="PASAPORTE">Pasaporte</option><option value="SINDOC">Sin Documento</option></>}
              </select>
            </div>
            
            <Input 
              label="Número de Identificación" 
              required 
              value={formData.nit} 
              onChange={(e) => setFormData({...formData, nit: e.target.value.replace(/[^0-9-]/g, '')})} 
              placeholder={category === "FORMAL" ? "Ej: 900.123.456-1" : "Ej: 1.140.800.900"}
            />
          </div>
        </Card>
        
        <Card title="Ubicación y Georeferenciación" icon="map-pin">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Municipio (Atlántico)</label>
              <div className="relative">
                <select 
                  className={selectCls} 
                  value={formData.city} 
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  required
                >
                  <option value="" disabled>Seleccione el municipio...</option>
                  {ATLANTICO_DATA.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </div>
            </div>
            
            {category !== "AMBULANTE" ? (
              <Input label="Dirección Exacta" required value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidad de Venta</label>
                  <select 
                    className={selectCls} 
                    value={formData.mobileUnitType} 
                    onChange={(e) => setFormData({...formData, mobileUnitType: e.target.value})}
                    required
                  >
                    <option value="" disabled>Seleccione tipo...</option>
                    {MOBILE_UNITS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {formData.mobileUnitType === "OTROS" && <Input label="¿Cuál Unidad?" required value={formData.mobileUnitOther} onChange={(e) => setFormData({...formData, mobileUnitOther: e.target.value})} />}
                <Input label="Sector / Zona" required value={formData.sector} onChange={(e) => setFormData({...formData, sector: e.target.value})} />
              </div>
            )}
          </div>
        </Card>

         <Card title="Responsabilidad y Contacto" icon="user" className="bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CORRECCIÓN DE ETIQUETA Y VALIDACIÓN */}
            <Input 
              label="Nombre Representante Legal (Persona Natural)" 
              required 
              value={formData.responsibleName} 
              onChange={handleResponsibleChange}
              placeholder="Nombres y Apellidos"
            />
            
            <Input 
              label="Cédula de Ciudadanía" 
              required 
              value={formData.responsibleId} 
              onChange={(e) => handleNumericChange(e, 'responsibleId')} 
              placeholder="Ej: 1.140.812.345"
            />
            
            <Input 
              label="Teléfono de Contacto" 
              required 
              value={formData.phone} 
              onChange={(e) => handleNumericChange(e, 'phone')} 
              placeholder="Ej: 3001234567"
            />
            <Input label="Email Notificaciones" type="email" required value={formData.emailJudicial} onChange={(e) => setFormData({...formData, emailJudicial: e.target.value})} />
          </div>
        </Card>

        {(category === "FORMAL" && (formData.type === "DROGUERÍA" || formData.type === "FARMACIA-DROGUERÍA")) && (
          <Card title="Dirección Técnica (Farmacéutica)" icon="shield-check" className="bg-teal-50/30 border-l-4 border-l-teal-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Input label="Nombre Director Técnico" required value={formData.techDirectorName} onChange={(e) => setFormData({...formData, techDirectorName: e.target.value})} />
              
              <Input 
                label="Cédula de Ciudadanía" 
                required 
                value={formData.techDirectorId} 
                onChange={(e) => handleNumericChange(e, 'techDirectorId')}
                placeholder="Ej: 72.345.678" 
              />
              
              <Input label="Tarjeta Profesional" value={formData.techDirectorTp} onChange={(e) => setFormData({...formData, techDirectorTp: e.target.value})} />
            </div>
          </Card>
        )}

        <div className="flex justify-end gap-4">
          <Button type="button" variant="secondary" onClick={() => navigate('/dashboard/census')}>Cancelar</Button>
          <Button type="submit" isLoading={loading}>Revisar Datos</Button>
        </div>
      </form>

      {/* MODAL ESPEJO: VISTA PREVIA */}
      {showPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 bg-slate-50 border-b border-slate-200">
              <h3 className="text-lg font-black text-content-primary text-center">Confirmar Nuevo Vigilado</h3>
              <p className="text-center text-xs text-content-tertiary mt-1">Así se verá en la base de datos oficial</p>
            </div>
            
            <div className="p-8">
              <div className="card-base p-6 border-2 border-brand-light shadow-lg">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <Badge label={category} variant="neutral" />
                    <span className="text-xs font-bold text-content-tertiary font-mono tracking-wide">NIT: {formData.nit.toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-content-primary leading-tight">{formData.name.toUpperCase()}</h3>
                    {formData.commercialName && <p className="text-sm text-content-secondary font-medium mt-1">"{formData.commercialName.toUpperCase()}"</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-content-secondary font-medium pt-2">
                    <div className="flex items-center gap-1.5 text-content-primary bg-surface-ground px-3 py-1 rounded-full border border-surface-border">
                      <Icon name="map-pin" size={14} className="text-brand" />
                      <span className="uppercase font-bold text-xs">{formData.city || "SIN ASIGNAR"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                       <span className="text-content-tertiary">|</span> <Icon name="user" size={14} /> {formData.responsibleName.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setShowPreview(false)} className="flex-1">Corregir</Button>
              <Button onClick={confirmSave} isLoading={loading} className="flex-1">Confirmar y Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};