import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

// Misma regla que ProtectedRoute: es "tienda" quien tiene un establecimiento APROBADO
// (así, cuando un comprador se convierte en tienda, se activa solo) o quien tiene rol 'tienda'.
async function consultarEsTienda() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: tiendas } = await supabase
    .from('establecimientos')
    .select('id')
    .eq('propietario_id', user.id)
    .or('estado.eq.APROBADO,estado.eq.aprobado')
    .limit(1);
  if (tiendas && tiendas.length > 0) return true;

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol, activo')
    .eq('id', user.id)
    .maybeSingle();
  if (perfil?.activo === false) return false;
  return perfil?.rol === 'tienda';
}

// Se guarda la consulta para no repetirla en cada componente que use el hook
let cache = null;
const obtener = () => {
  if (!cache) cache = consultarEsTienda().catch(() => false);
  return cache;
};

export default function useEsTienda() {
  const [esTienda, setEsTienda] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    const cargar = () =>
      obtener().then((valor) => {
        if (vigente) {
          setEsTienda(valor);
          setCargando(false);
        }
      });

    cargar();

    // Si el usuario inicia o cierra sesión, se vuelve a consultar
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      cache = null;
      setTimeout(cargar, 0);
    });

    return () => {
      vigente = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return { esTienda, cargando };
}
