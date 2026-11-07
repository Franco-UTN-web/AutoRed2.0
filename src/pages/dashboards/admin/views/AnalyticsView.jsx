import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';

export default function AnalyticsView() {
  const [metricas, setMetricas] = useState({
    total: 0,
    operando: 0,
    enRevision: 0,
    suspendidas: 0
  });

  const [datosSemana, setDatosSemana] = useState([
    { dia: 'Lun', cantidad: 0 },
    { dia: 'Mar', cantidad: 0 },
    { dia: 'Mié', cantidad: 0 },
    { dia: 'Jue', cantidad: 0 },
    { dia: 'Vie', cantidad: 0 },
    { dia: 'Sáb', cantidad: 0 },
    { dia: 'Dom', cantidad: 0 }
  ]);

  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      setCargando(true);
      try {
        const { data, error } = await supabase
          .from('establecimientos')
          .select('*');

        if (error) throw error;

        if (data) {
          const total = data.length;
          const operando = data.filter(t => t.estado === 'APROBADO' || t.estado === 'aprobado' || (!t.estado && t.activo)).length;
          const enRevision = data.filter(t => t.estado === 'PENDIENTE' || t.estado === 'pendiente').length;
          const suspendidas = data.filter(t => t.estado === 'SUSPENDIDO' || t.estado === 'suspendido').length;

          setMetricas({ total, operando, enRevision, suspendidas });

          // Conteo dinámico de registros por día de la semana
          const conteoDias = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 };

          data.forEach(item => {
            const fechaValida = item.created_at || item.created_at_timestamp || item.fecha_registro;
            if (fechaValida) {
              const fecha = new Date(fechaValida);
              const diaSemana = fecha.getDay(); // 0 = Dom, 1 = Lun, ...
              conteoDias[diaSemana] = (conteoDias[diaSemana] || 0) + 1;
            } else {
              // Si no tiene fecha guardada, asignamos de manera predeterminada al día actual
              const hoy = new Date().getDay();
              conteoDias[hoy] = (conteoDias[hoy] || 0) + 1;
            }
          });

          setDatosSemana([
            { dia: 'Lun', cantidad: conteoDias[1] || 0 },
            { dia: 'Mar', cantidad: conteoDias[2] || 0 },
            { dia: 'Mié', cantidad: conteoDias[3] || 0 },
            { dia: 'Jue', cantidad: conteoDias[4] || 0 },
            { dia: 'Vie', cantidad: conteoDias[5] || 0 },
            { dia: 'Sáb', cantidad: conteoDias[6] || 0 },
            { dia: 'Dom', cantidad: conteoDias[0] || 0 }
          ]);
        }
      } catch (err) {
        console.error("Error al obtener datos analíticos de Supabase:", err);
      } finally {
        setCargando(false);
      }
    };

    fetchAnalyticsData();
  }, []);

  const maxCantidad = Math.max(...datosSemana.map(d => d.cantidad), 5);
  const totalTiendas = metricas.total || 1;
  const pctOperando = Math.round((metricas.operando / totalTiendas) * 100);
  const pctRevision = Math.round((metricas.enRevision / totalTiendas) * 100);
  const pctSuspendidas = Math.round((metricas.suspendidas / totalTiendas) * 100);

  if (cargando) {
    return (
      <div className="p-8 flex justify-center items-center h-64 text-gray-400 font-bold animate-pulse">
        Cargando analíticas en tiempo real...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      
      {/* TARJETAS DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Total Tiendas</p>
          <p className="text-3xl font-black text-gray-900">{metricas.total}</p>
        </div>

        <div className="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-100 shadow-sm">
          <p className="text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Operando</p>
          <p className="text-3xl font-black text-emerald-600">{metricas.operando}</p>
        </div>

        <div className="bg-blue-50/60 p-5 rounded-2xl border border-blue-100 shadow-sm">
          <p className="text-xs font-black text-blue-700 uppercase tracking-wider mb-2">En Revisión</p>
          <p className="text-3xl font-black text-blue-600">{metricas.enRevision}</p>
        </div>

        <div className="bg-red-50/60 p-5 rounded-2xl border border-red-100 shadow-sm">
          <p className="text-xs font-black text-red-700 uppercase tracking-wider mb-2">Suspendidas</p>
          <p className="text-3xl font-black text-red-600">{metricas.suspendidas}</p>
        </div>
      </div>

      {/* GRÁFICAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* DONUT CHART: DISTRIBUCIÓN DE ESTATUS */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-between min-h-[340px]">
          <h3 className="text-lg font-black text-gray-900 w-full text-center mb-4">Distribución de Estatus</h3>
          
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              {/* Fondo del aro */}
              <path
                className="text-gray-100"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Segmento Operando */}
              <path
                className="text-emerald-500 transition-all duration-700 ease-out"
                strokeDasharray={`${pctOperando}, 100`}
                strokeWidth="4.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-3xl font-black text-gray-900">{metricas.operando}</span>
              <span className="block text-[10px] font-bold text-gray-400 uppercase">Activas</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold text-gray-600">Aprobadas ({metricas.operando})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className="text-xs font-bold text-gray-600">Pendientes ({metricas.enRevision})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-xs font-bold text-gray-600">Suspendidas ({metricas.suspendidas})</span>
            </div>
          </div>
        </div>

        {/* BAR CHART: NUEVOS REGISTROS DINÁMICOS */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between min-h-[340px]">
          <h3 className="text-lg font-black text-gray-900 w-full text-center mb-4">Nuevos Registros (Esta Semana)</h3>

          <div className="flex-1 flex items-end justify-between gap-3 pt-8 pb-4 px-4 border-b border-gray-100 relative">
            {/* Líneas de guía en el eje Y */}
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-200"></div>
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-200"></div>

            {datosSemana.map((item, idx) => {
              const alturaPct = Math.max((item.cantidad / maxCantidad) * 100, 8);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end z-10 group">
                  <span className="text-xs font-black text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.cantidad}
                  </span>
                  <div 
                    style={{ height: `${alturaPct}%` }}
                    className="w-full bg-autoblue hover:bg-blue-900 rounded-t-lg transition-all duration-500 shadow-sm"
                  ></div>
                  <span className="text-xs font-bold text-gray-500 mt-2">{item.dia}</span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-center font-bold text-gray-400 mt-4">
            Métricas calculadas en tiempo real desde Supabase
          </p>
        </div>

      </div>
    </div>
  );
}