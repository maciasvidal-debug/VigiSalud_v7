import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { DashboardHome } from './pages/DashboardHome';
import { CensusList } from './pages/census/CensusList';
import { CensusForm } from './pages/census/CensusForm';
import { CensusProfile } from './pages/census/CensusProfile'; // <--- 1. NUEVO IMPORT
import { InspectionList } from './pages/inspections/InspectionList';
import { InspectionViewer } from './pages/inspections/InspectionViewer';
import { InspectionWizard } from './pages/inspections/InspectionWizard'; 
import { TeamList } from './pages/team/TeamList';
import { TeamForm } from './pages/team/TeamForm';
import { MaintenanceCenter } from './pages/admin/MaintenanceCenter';
import { ResourceCenter } from './pages/resources/ResourceCenter';
import { useAuthStore } from './store/useAuthStore';
import { ToastProvider } from './context/ToastContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function App() {
  const user = useAuthStore((state) => state.user);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/dashboard" replace /> : <Login />} 
          />

          <Route 
            path="/" 
            element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} 
          />

          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            
            {/* RUTAS DE CENSO */}
            <Route path="census" element={<CensusList />} />
            <Route path="census/new" element={<CensusForm />} />
            <Route path="census/:id" element={<CensusProfile />} /> {/* <--- 2. RUTA REGISTRADA */}
            
            {/* RUTAS DE INSPECCIONES */}
            <Route path="inspections" element={<InspectionList />} />
            <Route path="inspections/new/:establishmentId" element={<InspectionWizard />} />
            <Route path="inspections/view/:id" element={<InspectionViewer />} />
            
            {/* RUTAS DE EQUIPO */}
            <Route path="team" element={<TeamList />} />
            <Route path="team/new" element={<TeamForm />} />
            <Route path="team/edit/:id" element={<TeamForm />} />

            {/* RUTAS ADMINISTRATIVAS */}
            <Route path="maintenance" element={<MaintenanceCenter />} />
            <Route path="resources" element={<ResourceCenter />} />
            
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;