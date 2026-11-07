import React, { useState, useEffect } from 'react';
import StoreManagement from './views/StoreManagement';
import { LayoutDashboard, Store } from 'lucide-react';
import AnalyticsView from './views/AnalyticsView';
import InventoryAudit from './views/InventoryAudit';
import UserManagement from './views/UserManagement';
import ApiUsagePanel from './ApiUsagePanel';
import { supabase } from '../../../supabase';

export default function AdminDashboard() {
  const [vistaActiva, setVistaActiva] = useState('tiendas');
  
  const [solicitudes, setSolicitudes] = useState([]);
  const [tiendasActivas, setTiendasActivas] = useState([]); 
  const [tiendasSuspendidas, setTiendasSuspendidas] = useState([]);
  
  const [metricas, setMetricas] = useState({ tiendasAprobadas: 0, tiendasPendientes: 0 });
  const [cargando, setCargando] = useState(true);
  
  const [procesandoId, setProcesandoId] = useState(null);
  const [tipoAccion, setTipoAccion] = useState(null);
  const [modalConfirm, setModalConfirm] = useState({ visible: false, id: null, accion: '', nombreTienda: '' });
  const [verDirectorio, setVerDirectorio] = useState(false);

  const fetchAdminData = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('establecimientos')
        .select('*');

      if (error) throw error;

      const pendientes = data.filter(tienda => tienda.estado === 'PENDIENTE');
      const aprobadas = data.filter(tienda => tienda.estado === 'APROBADO');
      const suspendidas = data.filter(tienda => tienda.estado === 'SUSPENDIDO');
      
      setSolicitudes(pendientes);
      setTiendasActivas(aprobadas);
      setTiendasSuspendidas(suspendidas);
      
      setMetricas({
        tiendasAprobadas: aprobadas.length,
        tiendasPendientes: pendientes.length
      });
    } catch (error) {
      console.error("Error cargando establecimientos desde Supabase:", error.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const confirmarAccion = (id, nombre, accion) => {
    setModalConfirm({ visible: true, id, accion, nombreTienda: nombre });
  };

  const ejecutarAccion = async () => {
    const { id, accion } = modalConfirm;
    setModalConfirm({ visible: false, id: null, accion: '', nombreTienda: '' });
    
    setProcesandoId(id);
    setTipoAccion(accion);

    let nuevoEstado = 'PENDIENTE';
    if (accion === 'aprobar' || accion === 'reactivar') nuevoEstado = 'APROBADO';
    else if (accion === 'suspender') nuevoEstado = 'SUSPENDIDO';
    else if (accion === 'rechazar') nuevoEstado = 'RECHAZADO';

    try {
      // 1. Obtener la tienda para conocer el propietario_id
      const tiendaProcesada = [...solicitudes, ...tiendasActivas, ...tiendasSuspendidas].find(t => t.id === id);

      // 2. Actualizar estado del establecimiento
      const { error } = await supabase
        .from('establecimientos')
        .update({ estado: nuevoEstado })
        .eq('id', id);

      if (error) throw error;

      // 3. 🟢 ACTUALIZAR AUTOMÁTICAMENTE A 'tienda' SOLO SI EL PROPIETARIO NO ES ADMIN
      if ((accion === 'aprobar' || accion === 'reactivar') && tiendaProcesada?.propietario_id) {
        const { data: perfilPropietario } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', tiendaProcesada.propietario_id)
          .maybeSingle();

        if (perfilPropietario && perfilPropietario.rol !== 'admin' && perfilPropietario.rol !== 'administrador') {
          await supabase
            .from('perfiles')
            .update({ rol: 'tienda' })
            .eq('id', tiendaProcesada.propietario_id);
        }
      }

      setTimeout(() => {
        if (accion === 'aprobar' || accion === 'reactivar') {
          setSolicitudes(prev => prev.filter(sol => sol.id !== id));
          setTiendasSuspendidas(prev => prev.filter(t => t.id !== id));
          setTiendasActivas(prev => [...prev, { ...tiendaProcesada, estado: 'APROBADO' }]);
          
          if (accion === 'aprobar') {
            setMetricas(prev => ({ tiendasAprobadas: prev.tiendasAprobadas + 1, tiendasPendientes: prev.tiendasPendientes - 1 }));
          } else {
            setMetricas(prev => ({ ...prev, tiendasAprobadas: prev.tiendasAprobadas + 1 }));
          }
        } 
        else if (accion === 'rechazar') {
          setSolicitudes(prev => prev.filter(sol => sol.id !== id));
          setMetricas(prev => ({ ...prev, tiendasPendientes: prev.tiendasPendientes - 1 }));
        } 
        else if (accion === 'suspender') {
          setTiendasActivas(prev => prev.filter(t => t.id !== id));
          setTiendasSuspendidas(prev => [...prev, { ...tiendaProcesada, estado: 'SUSPENDIDO' }]);
          setMetricas(prev => ({ ...prev, tiendasAprobadas: prev.tiendasAprobadas - 1 }));
        }
        
        setProcesandoId(null);
        setTipoAccion(null);
      }, 500);
    } catch (error) {
      setProcesandoId(null);
      setTipoAccion(null);
      alert(`Error al actualizar estado en Supabase: ${error.message}`);
    }
  };

  if (cargando) return <div className="flex h-screen items-center justify-center font-medium text-gray-500">Cargando panel...</div>;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 text-gray-800 font-sans overflow-hidden">
      <aside className="w-full md:w-64 bg-white border-b md:border-r border-gray-200 flex flex-col flex-shrink-0 z-10 p-4">
        <div className="space-y-2 md:space-y-6">
          <div className="flex items-center justify-between md:justify-start gap-2 px-2 py-2 md:py-3 border-b border-gray-100">
            <div>
              <span className="font-extrabold text-xl tracking-tight text-red-600">Auto<span className="text-gray-900">Red</span></span>
              <span className="ml-2 text-[10px] bg-red-50 text-red-700 border border-red-100 px-1.5 py-0.5 rounded font-bold">ADMIN</span>
            </div>
          </div>
          
          <nav className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <button
              onClick={() => setVistaActiva('tiendas')}
              className={`flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                vistaActiva === 'tiendas' ? 'bg-red-50/60 text-red-700' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Store size={18} /> Refaccionarias
            </button>
            <button
              onClick={() => setVistaActiva('analiticas')}
              className={`flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                vistaActiva === 'analiticas' ? 'bg-red-50/60 text-red-700' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <LayoutDashboard size={18} /> Analíticas
            </button>
            <button
              onClick={() => setVistaActiva('usuarios')}
              className={`flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                vistaActiva === 'usuarios' ? 'bg-red-50/60 text-red-700' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              Gestión de Clientes
            </button>
            <button
              onClick={() => setVistaActiva('auditoria')}
              className={`flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                vistaActiva === 'auditoria' ? 'bg-red-50/60 text-red-700' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              Auditoría Catálogo
            </button>

            <button
              onClick={() => setVistaActiva('ia')}
              className={`flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                vistaActiva === 'ia' ? 'bg-red-50/60 text-red-700' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Monitor IA
            </button>
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gray-50 relative p-0 md:p-4">
        {vistaActiva === 'tiendas' && (
          <StoreManagement 
            solicitudes={solicitudes}
            tiendasActivas={tiendasActivas}
            tiendasSuspendidas={tiendasSuspendidas}
            metricas={metricas}
            cargando={cargando}
            confirmarAccion={confirmarAccion}
            ejecutarAccion={ejecutarAccion}
            modalConfirm={modalConfirm}
            setModalConfirm={setModalConfirm}
            procesandoId={procesandoId}
            tipoAccion={tipoAccion}
            verDirectorio={verDirectorio}
            setVerDirectorio={setVerDirectorio}
            onSuccessUpdate={fetchAdminData}
          />
        )}
        {vistaActiva === 'analiticas' && <AnalyticsView />}
        {vistaActiva === 'auditoria' && <InventoryAudit />}
        {vistaActiva === 'usuarios' && <UserManagement />}
        {vistaActiva === 'ia' && <ApiUsagePanel />}
      </main>
    </div>
  );
}