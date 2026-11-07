import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { supabase } from './supabase';

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

  // ATRAPADOR DE SESIÓN DE GOOGLE (DIRECTO A SUPABASE)
  useEffect(() => {
    const handleGoogleAuth = async () => {
      const hash = window.location.hash;
      
      if (hash && hash.includes("access_token")) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");
        const type = params.get("type");

        if (type === "recovery") {
          localStorage.setItem('recovery_token', accessToken);
          window.history.replaceState(null, null, '/actualizar-password');
          window.location.reload();
          return;
        }

        try {
          const { data: { user }, error } = await supabase.auth.getUser(accessToken);

          if (error || !user) {
            console.error("Error al obtener usuario de Supabase:", error);
            return;
          }

          const { data: perfil } = await supabase
            .from('perfiles')
            .select('rol, activo, nombre')
            .eq('id', user.id)
            .maybeSingle();

          if (perfil && perfil.activo === false) {
            alert('Acceso denegado: Tu cuenta ha sido suspendida.');
            await supabase.auth.signOut();
            localStorage.clear();
            window.location.href = '/login'; 
            return; 
          }

          let rolFinal = perfil?.rol;
          let nombreFinal = perfil?.nombre || user.user_metadata?.nombre || user.user_metadata?.full_name || 'Usuario';

          if (!perfil) {
            rolFinal = 'comprador';
            await supabase.from('perfiles').upsert({
              id: user.id,
              nombre: nombreFinal,
              email: user.email,
              rol: 'comprador',
              activo: true
            });
          }

          const userData = {
            id: user.id,
            email: user.email,
            rol: rolFinal,
            user_metadata: {
              ...user.user_metadata,
              role: rolFinal,
              nombre: nombreFinal
            }
          };

          localStorage.setItem('session_token', accessToken);
          localStorage.setItem('user_data', JSON.stringify(userData));

          window.history.replaceState(null, null, '/inicio');
          window.location.href = '/inicio'; 

        } catch (err) {
          console.error("Error crítico en autenticación:", err);
        }
      }
    };

    handleGoogleAuth();
  }, []);

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
            
            {/* Rutas duplicadas para el mapa de sucursales sin pantalla en blanco */}
            <Route path="/directorio" element={<DirectorioSucursales />} />
            <Route path="/sucursales" element={<DirectorioSucursales />} />

            <Route path="/actualizar-password" element={<UpdatePassword />} />
            <Route path="/recuperar-password" element={<RecuperarPassword />} />
            
            {/* Rutas asignadas al AdminDashboard oficial con protección de rol */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin', 'administrador']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            
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
              <ProtectedRoute allowedRoles={['admin', 'administrador']}>
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