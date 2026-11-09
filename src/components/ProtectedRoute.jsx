import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const [loading, setLoading] = useState(true);
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    const verificarAcceso = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setAutorizado(false);
          setLoading(false);
          return;
        }

        // 1. Verificar si el usuario es dueño de un establecimiento APROBADO
        const { data: tiendaAprobada } = await supabase
          .from('establecimientos')
          .select('id, estado')
          .eq('propietario_id', user.id)
          .or('estado.eq.APROBADO,estado.eq.aprobado')
          .maybeSingle();

        // 2. Consultar perfil en la base de datos
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol, activo')
          .eq('id', user.id)
          .maybeSingle();

        let rolActual = perfil?.rol || user?.user_metadata?.role || user?.user_metadata?.rol || 'comprador';

        // Si posee tienda aprobada y no es admin, forzar la autorización como 'tienda'
        if (tiendaAprobada && rolActual !== 'admin' && rolActual !== 'administrador') {
          rolActual = 'tienda';
        }

        if (perfil && perfil.activo === false) {
          alert('Tu cuenta se encuentra suspendida por un administrador.');
          await supabase.auth.signOut();
          localStorage.clear();
          setAutorizado(false);
          setLoading(false);
          return;
        }

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