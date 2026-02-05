import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../db';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { WizardStepper, type StepItem } from '../../components/ui/WizardStepper'; // <--- STANDARDIZACIÓN
import { useToast } from '../../context/ToastContext';
import type { User } from '../../types';
import { hashPin } from '../../utils/security';

// --- CONSTANTES DE NEGOCIO (INTACTAS) ---
const VINCULACION_TYPES = [
  "Contratista (Prestación de Servicios - OPS)",
  "Carrera Administrativa (Propiedad)",
  "Nombramiento Provisional",
  "Libre Nombramiento y Remoción",
  "Planta Temporal",
  "Trabajador Oficial"
];

const CARGOS_OFICIALES = [
  "Director Técnico", "Secretario de Despacho", "Profesional Especializado",
  "Profesional Universitario", "Técnico Operativo", "Técnico Administrativo",
  "Inspector Sanitario (Contratista)"
];

const RH_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

// Configuración del Stepper
const STEPS: StepItem[] = [
  { id: 1, label: 'Identidad', icon: 'user', description: 'Datos Personales' },
  { id: 2, label: 'Vinculación', icon: 'briefcase', description: 'Perfil Contractual' },
  { id: 3, label: 'Seguridad', icon: 'lock', description: 'Credenciales' }
];

export const TeamForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ESTADOS (INTACTOS)
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState<User>({
    name: '', identification: '', rh: 'O+', username: '', pin: '',
    role: 'INSPECTOR', status: 'ACTIVO', cargo: "Técnico Operativo",
    contractType: "Contratista (Prestación de Servicios - OPS)",
    contractNumber: '', contractDateStart: '', contractDateEnd: '',
    profession: '', tp: '', email: '', personalEmail: '', phone: '',
    photo: null
  });

  // CARGA DE DATOS (EDICIÓN)
  useEffect(() => {
    if (id) {
      setIsEditing(true);
      db.officials.get(Number(id)).then(user => {
        if (user) {
            setFormData({ 
                ...user, 
                pin: '', // Seguridad: Limpiar hash
                phone: user.phone || '',
                email: user.email || '',
                personalEmail: user.personalEmail || '',
                profession: user.profession || '',
                tp: user.tp || '',
                contractNumber: user.contractNumber || '',
                contractDateStart: user.contractDateStart || '',
                contractDateEnd: user.contractDateEnd || ''
            });
        }
      });
    }
  }, [id]);

  // MANEJADORES
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const processImage = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxSize = 300;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) { height *= maxSize / width; width = maxSize; }
        } else {
          if (height > maxSize) { width *= maxSize / height; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        setFormData(prev => ({ ...prev, photo: canvas.toDataURL('image/webp', 0.8) }));
      };
    };
  };

  // NAVEGACIÓN
  const validateStep = (step: number) => {
    if (step === 1) {
      if (!formData.name || !formData.identification) {
        showToast("Por favor complete Nombre y Cédula.", 'warning');
        return false;
      }
    }
    return true;
  };

  const handleStepClick = (stepId: number) => {
    if (stepId < currentStep || validateStep(currentStep)) {
        setCurrentStep(stepId);
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username) return showToast("El usuario es obligatorio.", 'warning');
    if (!isEditing && !formData.pin) return showToast("El PIN es obligatorio para nuevos usuarios.", 'warning');
    setShowPreview(true);
  };

  const confirmSave = async () => {
    setLoading(true);
    try {
      let securePin = formData.pin;
      if (formData.pin) {
        securePin = await hashPin(formData.pin.trim());
      } else if (isEditing && id) {
        const original = await db.officials.get(Number(id));
        if (original) securePin = original.pin;
      }

      const sanitizedData: User = {
        ...formData,
        name: formData.name.trim().toUpperCase(),
        identification: formData.identification.trim().toUpperCase(),
        username: formData.username.trim().toUpperCase(),
        pin: securePin,
        profession: formData.profession?.trim().toUpperCase() || '',
        tp: formData.tp?.trim().toUpperCase() || '',
        contractNumber: formData.contractNumber?.trim().toUpperCase() || '',
        email: formData.email?.trim().toLowerCase() || '',
        personalEmail: formData.personalEmail?.trim().toLowerCase() || '',
        phone: formData.phone?.trim() || ''
      };

      if (isEditing && id) {
        await db.officials.update(Number(id), sanitizedData);
        showToast("Funcionario actualizado correctamente.", 'success');
      } else {
        const exists = await db.officials.where('username').equals(sanitizedData.username).count();
        if (exists > 0) {
          showToast('El nombre de usuario ya existe.', 'error');
          setLoading(false);
          setShowPreview(false);
          return;
        }
        await db.officials.add(sanitizedData);
        showToast("Funcionario vinculado exitosamente.", 'success');
      }
      navigate('/dashboard/team');
    } catch (error) {
      console.error(error);
      showToast('Error al guardar en la base de datos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20">
      
      {/* HEADER */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/dashboard/team')} className="p-2 hover:bg-surface-hover rounded-full text-content-tertiary transition-colors">
            <Icon name="arrow-left" size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-content-primary tracking-tight">
              {isEditing ? 'Actualizar Funcionario' : 'Vincular Nuevo Funcionario'}
            </h1>
            <p className="text-sm text-content-secondary font-medium">Asistente de gestión de talento humano</p>
          </div>
        </div>

        {/* --- AQUÍ ESTÁ LA ESTANDARIZACIÓN --- */}
        <div className="bg-surface-card rounded-2xl p-6 shadow-sm border border-surface-border">
            <WizardStepper 
                steps={STEPS} 
                currentStep={currentStep} 
                onStepClick={handleStepClick}
            />
        </div>
      </div>

      <form onSubmit={handlePreSubmit}>
        
        {/* --- PASO 1: IDENTIDAD --- */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fade-in">
            <Card title="Identificación Personal" icon="user">
              <div className="flex flex-col md:flex-row gap-8">
                
                {/* Bloque Izquierdo */}
                <div className="flex-1 space-y-4">
                   <Input label="Nombre Completo" name="name" required value={formData.name} onChange={handleChange} placeholder="Nombres y Apellidos" />
                   <div className="grid grid-cols-2 gap-4">
                      <Input label="Cédula" name="identification" required value={formData.identification} onChange={handleChange} />
                      <div>
                        <label className="block text-xs font-bold text-content-secondary mb-1.5 uppercase">RH</label>
                        <select name="rh" value={formData.rh} onChange={handleChange} className="input-field">
                          {RH_TYPES.map(rh => <option key={rh} value={rh}>{rh}</option>)}
                        </select>
                      </div>
                   </div>
                   
                   <Input label="Móvil / WhatsApp" name="phone" type="tel" value={formData.phone || ''} onChange={handleChange} />
                   <Input label="Email Personal (Recuperación)" name="personalEmail" type="email" value={formData.personalEmail || ''} onChange={handleChange} />
                </div>

                {/* Bloque Derecho: Foto */}
                <div className="w-full md:w-1/3 flex flex-col items-center justify-center bg-surface-ground rounded-xl border border-dashed border-surface-border p-6">
                   <div 
                      className="w-32 h-32 rounded-full bg-white border-4 border-white shadow-md mb-4 overflow-hidden relative group cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                   >
                      {formData.photo ? (
                        <img src={formData.photo} className="w-full h-full object-cover" alt="Foto" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-content-tertiary">
                           <Icon name="camera" size={40} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center text-white text-xs font-bold">CAMBIAR</div>
                   </div>
                   <Button type="button" variant="secondary" className="w-full text-xs" onClick={() => fileInputRef.current?.click()}>
                      <Icon name="upload" size={14}/> {formData.photo ? 'Cambiar Foto' : 'Subir Foto'}
                   </Button>
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                      if (e.target.files?.[0]) processImage(e.target.files[0]);
                   }} />
                </div>

              </div>
            </Card>
          </div>
        )}

        {/* --- PASO 2: VINCULACIÓN --- */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-fade-in">
             <Card title="Perfil Profesional y Contractual" icon="briefcase">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-content-secondary mb-1.5 uppercase">Tipo de Vinculación</label>
                      <select name="contractType" value={formData.contractType} onChange={handleChange} className="input-field font-medium">
                        {VINCULACION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-content-secondary mb-1.5 uppercase">Cargo Oficial</label>
                      <select name="cargo" value={formData.cargo} onChange={handleChange} className="input-field font-medium">
                        {CARGOS_OFICIALES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>
                   
                   <Input label="Profesión / Título" name="profession" value={formData.profession || ''} onChange={handleChange} />
                   
                   <div className="md:col-span-2 border-t border-surface-border my-2"></div>
                   
                   <Input label="No. Contrato / Resolución" name="contractNumber" placeholder="Ej: OPS-2026-001" value={formData.contractNumber || ''} onChange={handleChange} />
                   <Input label="Tarjeta Profesional" name="tp" value={formData.tp || ''} onChange={handleChange} />
                   
                   <Input label="Inicio Vigencia" name="contractDateStart" type="date" value={formData.contractDateStart || ''} onChange={handleChange} />
                   <Input label="Fin Vigencia" name="contractDateEnd" type="date" value={formData.contractDateEnd || ''} onChange={handleChange} />
                   
                   <div className="md:col-span-2">
                     <Input label="Email Institucional" name="email" type="email" value={formData.email || ''} onChange={handleChange} />
                   </div>
                </div>
             </Card>
          </div>
        )}

        {/* --- PASO 3: SEGURIDAD --- */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-fade-in">
             <Card title="Credenciales de Acceso" icon="lock">
                <div className="max-w-md mx-auto space-y-6 py-4">
                  <div className="bg-status-infoBg p-4 rounded-xl border border-status-info/20 flex gap-3">
                    <div className="text-status-info"><Icon name="info" size={20}/></div>
                    <p className="text-xs text-status-info/80 leading-relaxed">
                      El rol define los permisos críticos. <strong>INSPECTOR</strong> solo puede realizar visitas. <strong>DIRECTOR</strong> tiene control total.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-content-secondary mb-1.5 uppercase">Rol en VigiSalud</label>
                    <select name="role" value={formData.role} onChange={handleChange} className="input-field font-bold text-content-primary">
                      <option value="INSPECTOR">INSPECTOR (Operativo)</option>
                      <option value="COORDINADOR">COORDINADOR (Gestión)</option>
                      <option value="DIRECTOR">DIRECTOR (Administrativo)</option>
                      <option value="ADMIN">ADMIN (Soporte)</option>
                    </select>
                  </div>

                  <Input label="Usuario de Ingreso" name="username" required value={formData.username} onChange={handleChange} placeholder="Ej: JPEREZ" />
                  
                  <div className="pt-2">
                    <Input 
                      label={isEditing ? "Nuevo PIN (Dejar vacío para mantener)" : "Asignar PIN de Firma (4 Dígitos)"} 
                      name="pin" required={!isEditing} type="password" maxLength={4} 
                      value={formData.pin || ''} onChange={handleChange} 
                      placeholder="••••"
                    />
                  </div>
                </div>
             </Card>
          </div>
        )}

        {/* --- BOTONERA --- */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-surface-border">
          {currentStep > 1 ? (
            <Button type="button" variant="secondary" onClick={handlePrev}>
              <Icon name="arrow-left" size={16}/> Anterior
            </Button>
          ) : <div></div>}

          {currentStep < 3 ? (
            <Button type="button" onClick={handleNext} className="btn-primary">
              Siguiente <Icon name="arrow-right" size={16}/>
            </Button>
          ) : (
            <Button type="submit" isLoading={loading} className="btn-primary">
              <Icon name="check" size={18} /> {isEditing ? 'Actualizar Datos' : 'Vincular Funcionario'}
            </Button>
          )}
        </div>
      </form>

      {/* MODAL PREVIEW (Sin cambios lógicos) */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
           <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl transform transition-all scale-100">
              <div className="text-center mb-6">
                 <div className="w-16 h-16 bg-brand-light text-brand-dark rounded-full flex items-center justify-center mx-auto mb-3">
                   <Icon name="user-check" size={32}/>
                 </div>
                 <h3 className="font-black text-xl text-content-primary">Confirmar Vinculación</h3>
                 <p className="text-sm text-content-secondary mt-1">Verifique que la información sea correcta.</p>
              </div>
              
              <div className="bg-surface-ground p-4 rounded-xl border border-surface-border text-xs space-y-3 mb-6">
                 <div className="flex justify-between border-b border-surface-border pb-2">
                   <span className="text-content-secondary">Funcionario:</span> 
                   <strong className="text-content-primary uppercase">{formData.name}</strong>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-content-secondary">Contrato:</span> 
                   <strong>{formData.contractNumber || 'N/A'}</strong>
                 </div>
              </div>

              <div className="flex gap-3">
                 <Button variant="secondary" onClick={() => setShowPreview(false)} className="flex-1">Corregir</Button>
                 <Button onClick={confirmSave} className="flex-1 btn-primary">Confirmar</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};