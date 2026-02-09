import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { db } from '../db';
import type { User } from '../types';
import { verifyPin, hashPin } from '../utils/security';

// Definimos la respuesta detallada para que el Login sepa qué pasó
interface LoginResponse {
  success: boolean;
  message?: string;
}

interface AuthState {
  user: User | null;
  login: (username: string, pin: string) => Promise<LoginResponse>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // MOCK USER FOR VERIFICATION
      user: {
          id: 'mock-user-id',
          name: 'Jules Tester',
          username: 'TESTER',
          role: 'INSPECTOR',
          status: 'ACTIVO',
          contractDateEnd: '2030-12-31',
          pin: 'mock-pin'
      } as User,

      login: async (username: string, pin: string): Promise<LoginResponse> => {
        try {
          const normalizedUser = username.toUpperCase();
          
          // Obtenemos la fecha de hoy (inicio del día) para comparaciones justas
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
          
          // 1. BÚSQUEDA DE USUARIO
          const official = await db.officials
            .where('username')
            .equals(normalizedUser)
            .first();

          if (!official) {
            return { success: false, message: 'Usuario no encontrado en la base de datos.' };
          }

          // =================================================================
          // 2. SMART CONTRACT GUARD (Control de Vigencia Legal)
          // =================================================================
          
          // A) KILL-SWITCH: ¿El contrato ya venció?
          if (official.contractDateEnd && official.contractDateEnd < today) {
            // Si el usuario aparece activo, el sistema lo desactiva automáticamente (Auditoría)
            if (official.status === 'ACTIVO') {
              console.warn(`⛔ BLOQUEO AUTOMÁTICO: Contrato de ${official.name} vencido el ${official.contractDateEnd}.`);
              await db.officials.update(official.id!, { status: 'INACTIVO' });
              official.status = 'INACTIVO'; // Actualizamos el objeto en memoria
            }
            
            return { 
              success: false, 
              message: `ACCESO DENEGADO: Su contrato finalizó el ${official.contractDateEnd}. Contacte a Talento Humano.` 
            };
          }

          // B) AUTO-REVIVAL: ¿El contrato es vigente hoy pero el usuario estaba INACTIVO?
          // (Caso: El Director renovó la fecha pero olvidó cambiar el estado manual)
          if (official.status === 'INACTIVO' && official.contractDateEnd && official.contractDateEnd >= today) {
             console.log(`✅ REACTIVACIÓN AUTOMÁTICA: Se detectó vigencia contractual para ${official.name}.`);
             await db.officials.update(official.id!, { status: 'ACTIVO' });
             official.status = 'ACTIVO'; // Lo revivimos en memoria para permitir el paso
          }

          // =================================================================
          // 3. VALIDACIONES DE ESTADO (Capa Administrativa)
          // =================================================================

          // Bloqueo duro para ADMIN (El Admin no depende de fechas, sino de interruptor manual)
          if (normalizedUser === 'ADMIN' && official.status !== 'ACTIVO') {
            return { success: false, message: 'La cuenta de Administrador está bloqueada.' };
          }

          // Si tras el Smart Guard el usuario sigue inactivo (ej: despido disciplinario sin fecha fin)
          if (official.status !== 'ACTIVO') {
            return { success: false, message: 'Su usuario se encuentra INACTIVO en el sistema.' };
          }

          // =================================================================
          // 4. VALIDACIÓN DE CREDENCIALES (Seguridad Criptográfica)
          // =================================================================

          const isValid = await verifyPin(pin, official.pin);

          if (isValid) {
            // --- AUTO-HEALING (Migración de Seguridad) ---
            // Si el PIN en BD no es un hash (no tiene ':'), lo encriptamos ahora mismo.
            if (!official.pin.includes(':')) {
               console.log("🔒 Seguridad: Migrando credencial heredada a encriptación robusta SHA-256...");
               const secureHash = await hashPin(pin);
               await db.officials.update(official.id!, { pin: secureHash });
               official.pin = secureHash; 
            }

            // --- ÉXITO: INICIO DE SESIÓN ---
            // Eliminamos el PIN del objeto antes de guardarlo en el estado global (Sanitización)
            const { pin: _sensitivePin, ...safeUser } = official;
            set({ user: safeUser as User });
            
            return { success: true };
          }

          return { success: false, message: 'PIN de acceso incorrecto.' };

        } catch (error) {
          console.error('Error crítico en login:', error);
          return { success: false, message: 'Error interno del sistema de autenticación.' };
        }
      },

      logout: () => set({ user: null }),
    }),
    {
      name: 'vigisalud-auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);