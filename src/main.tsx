import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css' // Importante para que no se vea feo
import { db } from './db.ts'; // Importante para crear el usuario

// --- LÓGICA GÉNESIS (Restaurada) ---
const initializeSystem = async () => {
  try {
    // Verificar si existe el Admin
    const adminExists = await db.officials.where('username').equals('ADMIN').count();
    
    if (adminExists === 0) {
      console.log('🌱 GÉNESIS: Creando usuario ADMIN por defecto...');
      await db.officials.add({
        username: 'ADMIN',
        pin: '1234',
        name: 'Administrador VigiSalud',
        identification: '999999999',
        role: 'DIRECTOR',
        status: 'ACTIVO',
        cargo: 'Director IVC',
        contractType: 'Planta',
        email: 'admin@atlantico.gov.co'
      });
      console.log('✅ USUARIO CREADO EXITOSAMENTE');
    }
  } catch (error) {
    console.error('Error al inicializar sistema:', error);
  }
};

// Ejecutar la creación del usuario antes de renderizar (o en paralelo)
initializeSystem();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)