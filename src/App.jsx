import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RolesPanel from './pages/RolesPanel';
import { useEffect } from 'react';
import { supabase } from './supabase'; // Asegúrate de ajustar esta ruta si tu cliente está en otra carpeta


import Navbar from './components/Navbar';
import ChatWindow from './components/ChatWindow';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

import SobreNosotros from './pages/SobreNosotros';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import Login from './pages/Login'; 
import ProductDetail from './pages/ProductDetail'; 
import StoreProfile from './pages/StoreProfile';
import RegistroNegocio from './pages/RegistroNegocio';
import DirectorioSucursales from './pages/DirectorioSucursales';
import UpdatePassword from './pages/UpdatePassword';
import RecuperarPassword from './pages/RecuperarPassword';

import CustomerDashboard from './pages/dashboards/customer/CustomerDashboard';
import StoreDashboard from './pages/dashboards/store/StoreDashboard';
import AdminDashboard from './pages/dashboards/admin/AdminDashboard';

function App() {

  // ==========================================
  // ATRAPADOR DE SESIÓN DE GOOGLE (Corregido)
  // ==========================================
useEffect(() => {
  const handleGoogleAuth = async () => {
    const hash = window.location.hash;
    
    if (hash && hash.includes("access_token")) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      const type = params.get("type");

      // 1. RECUPERACIÓN DE CONTRASEÑA
      if (type === "recovery") {
        localStorage.setItem('recovery_token', accessToken);
        window.history.replaceState(null, null, '/actualizar-password');
        window.location.reload();
        return;
      }

      // 2. INICIO DE SESIÓN CON GOOGLE
      try {
        // Obtener usuario directamente del cliente Supabase activo
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);

        if (error || !user) {
          console.error("Error al obtener usuario de Supabase:", error);
          return;
        }

        // Estructura base del usuario
        const userData = {
          id: user.id,
          email: user.email,
          user_metadata: {
            ...user.user_metadata,
            role: 'comprador', // Rol por defecto inmediato
            nombre: user.user_metadata?.nombre || user.user_metadata?.full_name || 'Usuario'
          }
        };

        // 🟢 PASO CLAVE: Guardar en localStorage INMEDIATAMENTE
        localStorage.setItem('session_token', accessToken);
        localStorage.setItem('user_data', JSON.stringify(userData));

        // Intento de sincronización con Railway (sin bloquear el guardado local)
        try {
          const syncResponse = await fetch('https://backautored-production.up.railway.app/api/login/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: user.id,
              email: user.email,
              nombre: userData.user_metadata.nombre
            })
          });

          if (syncResponse.ok) {
            const syncData = await syncResponse.json();
            if (syncData.activo === 'false' || syncData.activo === false) {
              alert('Acceso denegado: Tu cuenta ha sido suspendida.');
              localStorage.clear();
              window.location.href = '/login'; 
              return; 
            }
            // Actualizar rol real si Railway responde con éxito
            userData.user_metadata.role = syncData.rol || 'comprador';
            userData.user_metadata.nombre = syncData.nombre || userData.user_metadata.nombre;
            localStorage.setItem('user_data', JSON.stringify(userData));
          }
        } catch (backendErr) {
          console.warn("Backend Railway no disponible o lento, continuando con datos locales:", backendErr);
        }

        // Limpiar URL y redirigir formalmente a /inicio
        window.history.replaceState(null, null, '/inicio');
        window.location.href = '/inicio'; 

      } catch (err) {
        console.error("Error crítico en autenticación:", err);
      }
    }
  };

  handleGoogleAuth();
}, []);
  // ==========================================

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 font-sans selection:bg-autoblue selection:text-white">
        
        <Navbar />
        
        <main className="flex-grow">
          <Routes>
            <Route path="/nosotros" element={<SobreNosotros />} />
            <Route path="/" element={<Home />} />
            <Route path="/inicio" element={<Home />} />    
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/login" element={<Login />} />
            <Route path="/producto/:id" element={<ProductDetail />} />
            <Route path="/tienda/:id" element={<StoreProfile />} />
            <Route path="/registro-negocio" element={<RegistroNegocio />} />
            <Route path="/directorio" element={<DirectorioSucursales />} />
            <Route path="/actualizar-password" element={<UpdatePassword />} />
            <Route path="/recuperar-password" element={<RecuperarPassword />} />
            <Route path="/admin" element={<RolesPanel />} />
            
            <Route path="/dashboard/customer" element={
              <ProtectedRoute allowedRoles={['comprador']}>
                <CustomerDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/dashboard/store" element={
              <ProtectedRoute allowedRoles={['tienda']}>
                <StoreDashboard />
              </ProtectedRoute>
            } /> 
            
            <Route path="/dashboard/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
          </Routes>
        </main>

        <Footer />
        <ChatWindow />
        
      </div>
    </Router>
  );
}

export default App;