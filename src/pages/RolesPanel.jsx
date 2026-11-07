import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function RolesPanel() {
  const [activeRole, setActiveRole] = useState('admin');
  const [cargando, setCargando] = useState(true);

  // Estados para métricas y datos de Admin
  const [metricas, setMetricas] = useState({ usuarios: 0, tiendas: 0, pendientes: 0 });
  const [solicitudes, setSolicitudes] = useState([]);

  useEffect(() => {
    cargarDatosAdmin();
  }, []);

  const cargarDatosAdmin = async () => {
    setCargando(true);
    try {
      // 1. Obtener total de usuarios
      const { count: totalUsuarios } = await supabase
        .from('perfiles')
        .select('*', { count: 'exact', head: true });

      // 2. Obtener total de tiendas aprobadas
      const { count: totalTiendas } = await supabase
        .from('establecimientos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'APROBADO');

      // 3. Obtener solicitudes pendientes
      const { data: listaPendientes, error: errPendientes } = await supabase
        .from('establecimientos')
        .select('*')
        .eq('estado', 'PENDIENTE');

      if (errPendientes) console.error('Error al cargar solicitudes:', errPendientes.message);

      setMetricas({
        usuarios: totalUsuarios || 0,
        tiendas: totalTiendas || 0,
        pendientes: listaPendientes ? listaPendientes.length : 0,
      });

      setSolicitudes(listaPendientes || []);
    } catch (error) {
      console.error('Error en dashboard admin:', error);
    } finally {
      setCargando(false);
    }
  };

  // Función para aprobar o rechazar un establecimiento
  const cambiarEstadoEstablecimiento = async (id, nuevoEstado) => {
    const { error } = await supabase
      .from('establecimientos')
      .update({ estado: nuevoEstado })
      .eq('id', id);

    if (error) {
      alert(`Error al actualizar estado: ${error.message}`);
    } else {
      alert(`Establecimiento ${nuevoEstado.toLowerCase()} con éxito.`);
      cargarDatosAdmin(); // Recargar lista y contadores
    }
  };

  const roles = [
    { id: 'admin', name: 'Administrador', icon: '⚙️' },
    { id: 'distributor', name: 'Distribuidora', icon: '🏢' },
    { id: 'shop', name: 'Refaccionaria', icon: '🏪' },
    { id: 'customer', name: 'Cliente/Mecánico', icon: '🔧' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white py-10">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-2">Portal de Administración y Roles</h1>
        <p className="text-gray-400 mb-8">Gestión global de usuarios y solicitudes de establecimientos.</p>

        {/* Tabs de Selección */}
        <div className="flex flex-wrap gap-2 mb-8 bg-gray-900 p-2 rounded-xl border border-gray-800">
          {roles.map(role => (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all text-sm flex items-center justify-center gap-2
                ${activeRole === role.id 
                  ? 'bg-emerald-600 text-white shadow-lg' 
                  : 'bg-transparent text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
              <span>{role.icon}</span>
              {role.name}
            </button>
          ))}
        </div>

        {/* VISTA ADMINISTRADOR (CONECTADA A SUPABASE) */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {activeRole === 'admin' && (
            <div>
              <h2 className="text-xl font-semibold mb-6 text-emerald-400">Panel de Control Global</h2>
              
              {/* Tarjetas de Métricas Reales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                  <p className="text-gray-400 text-sm">Usuarios Registrados</p>
                  <p className="text-3xl font-bold mt-2">{cargando ? '...' : metricas.usuarios}</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                  <p className="text-gray-400 text-sm">Refaccionarias Aprobadas</p>
                  <p className="text-3xl font-bold mt-2">{cargando ? '...' : metricas.tiendas}</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                  <p className="text-gray-400 text-sm">Solicitudes Pendientes</p>
                  <p className="text-3xl font-bold mt-2 text-yellow-400">{cargando ? '...' : metricas.pendientes}</p>
                </div>
              </div>

              {/* Tabla de Aprobación de Establecimientos */}
              <h3 className="text-lg font-semibold mb-4 text-white">Solicitudes de Creación de Establecimiento</h3>
              
              {cargando ? (
                <p className="text-gray-400">Cargando solicitudes...</p>
              ) : solicitudes.length === 0 ? (
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 text-center text-gray-400">
                  No hay solicitudes de establecimientos pendientes por aprobar.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-sm">
                        <th className="py-3 px-4">Nombre / Razón Social</th>
                        <th className="py-3 px-4">Teléfono</th>
                        <th className="py-3 px-4">Ciudad</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 text-sm">
                      {solicitudes.map((tienda) => (
                        <tr key={tienda.id}>
                          <td className="py-3 px-4 font-medium">{tienda.nombre}</td>
                          <td className="py-3 px-4 text-gray-300">{tienda.telefono || 'N/A'}</td>
                          <td className="py-3 px-4 text-gray-300">{tienda.ciudad || 'N/A'}</td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => cambiarEstadoEstablecimiento(tienda.id, 'APROBADO')}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium text-xs"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => cambiarEstadoEstablecimiento(tienda.id, 'RECHAZADO')}
                              className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg font-medium text-xs"
                            >
                              Rechazar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeRole === 'distributor' && (
            <div>
              <h2 className="text-xl font-semibold mb-6 text-blue-400">Gestión de Inventario Mayorista</h2>
              <p className="text-gray-400">Modulo en desarrollo...</p>
            </div>
          )}

          {activeRole === 'shop' && (
            <div>
              <h2 className="text-xl font-semibold mb-6 text-purple-400">Mostrador Digital</h2>
              <p className="text-gray-400">Modulo en desarrollo...</p>
            </div>
          )}

          {activeRole === 'customer' && (
            <div>
              <h2 className="text-xl font-semibold mb-6 text-white">Mi Taller Virtual</h2>
              <p className="text-gray-400">Modulo en desarrollo...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}