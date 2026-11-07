import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const [loading, setLoading] = useState(true);
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    const verificarAcceso = async () => {
      try {
        // 1. Obtener usuario de la sesión activa de Supabase
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setAutorizado(false);
          setLoading(false);
          return;
        }

        // 2. Consultar ROL FRESCO directamente en la base de datos
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol, activo')
          .eq('id', user.id)
          .maybeSingle();

        const rolActual = perfil?.rol || user.user_metadata?.role || 'comprador';

        // 3. Sincronizar el rol fresco en el localStorage para que el Navbar responda
        const datosLocales = localStorage.getItem('user_data');
        if (datosLocales && datosLocales !== "undefined") {
          try {
            const parsed = JSON.parse(datosLocales);
            parsed.rol = rolActual;
            if (parsed.user_metadata) parsed.user_metadata.role = rolActual;
            localStorage.setItem('user_data', JSON.stringify(parsed));
          } catch (e) {
            console.warn("Error parseando user_data local");
          }
        }

        if (perfil && perfil.activo === false) {
          alert('Tu cuenta se encuentra suspendida por un administrador.');
          await supabase.auth.signOut();
          localStorage.clear();
          setAutorizado(false);
          setLoading(false);
          return;
        }

        // 4. Verificar si el rol actual coincide con los roles permitidos
        if (allowedRoles.includes(rolActual)) {
          setAutorizado(true);
        } else {
          setAutorizado(false);
        }
      } catch (error) {
        console.error("Error verificando permisos de usuario:", error);
        setAutorizado(false);
      } finally {
        setLoading(false);
      }
    };

    verificarAcceso();
  }, [allowedRoles]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-medium">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-autoblue border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-600">Verificando credenciales de seguridad...</p>
        </div>
      </div>
    );
  }

  if (!autorizado) {
    return <Navigate to="/inicio" replace />;
  }

  return children;
}