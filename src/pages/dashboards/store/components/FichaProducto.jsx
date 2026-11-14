import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/supabase';

function Dato({ etiqueta, valor, mono = false }) {
  if (!valor && valor !== 0) return null;
  return (
    <div>
      <p className="text-[10px] uppercase font-black text-gray-400">{etiqueta}</p>
      <p className={`text-sm text-gray-800 ${mono ? 'font-mono' : 'font-medium'}`}>{valor}</p>
    </div>
  );
}

/**
 * Ficha de una pieza a partir del id de su registro en `inventarios`.
 * Consulta directo a Supabase: inventarios + piezas(*) y, aparte, el establecimiento.
 */
export default function FichaProducto({ inventarioId, miEstablecimientoId, onEditar, onCerrar }) {
  const [item, setItem] = useState(null);
  const [tienda, setTienda] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;

    const cargar = async () => {
      setCargando(true);
      setError('');
      setItem(null);
      setTienda(null);
      try {
        let { data, error: err } = await supabase
          .from('inventarios')
          .select('*, piezas(*)')
          .eq('id', inventarioId)
          .maybeSingle();

        // Respaldo si falla el JOIN
        if (err) {
          const { data: inv, error: errInv } = await supabase
            .from('inventarios').select('*').eq('id', inventarioId).maybeSingle();
          if (errInv) throw errInv;
          if (inv) {
            const { data: pz } = await supabase.from('piezas').select('*').eq('id', inv.pieza_id).maybeSingle();
            data = { ...inv, piezas: pz || {} };
          } else {
            data = null;
          }
        }

        if (!data) {
          if (vigente) setError('No encontramos ninguna pieza con ese código QR.');
          return;
        }

        const pieza = Array.isArray(data.piezas) ? data.piezas[0] : (data.piezas || {});
        const { data: t } = await supabase
          .from('establecimientos').select('*').eq('id', data.establecimiento_id).maybeSingle();

        if (vigente) {
          setItem({ ...data, pieza });
          setTienda(t || null);
        }
      } catch (e) {
        if (vigente) setError('No se pudo consultar la pieza: ' + e.message);
      } finally {
        if (vigente) setCargando(false);
      }
    };

    cargar();
    return () => { vigente = false; };
  }, [inventarioId]);

  const p = item?.pieza || {};
  const esMia = !!item && !!miEstablecimientoId && item.establecimiento_id === miEstablecimientoId;
  const compat = [p.marca_vehiculo, p.modelo, p.anio_vehiculo].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {cargando && <div className="p-8 text-center text-gray-500 font-bold animate-pulse">Consultando pieza...</div>}

        {!cargando && error && (
          <div className="p-4 text-center">
            <p className="text-red-600 font-bold mb-4">{error}</p>
            <button type="button" onClick={onCerrar} className="px-6 py-2.5 bg-gray-100 font-bold rounded-xl text-sm hover:bg-gray-200 cursor-pointer">Cerrar</button>
          </div>
        )}

        {!cargando && item && (
          <>
            <div className="flex gap-4">
              {p.imagen_url ? (
                <img src={p.imagen_url} alt={p.nombre_comercial} className="w-24 h-24 object-cover rounded-xl border border-gray-100 bg-gray-50" />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 font-black text-3xl border border-gray-200">
                  {p.nombre_comercial?.charAt(0) || 'P'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                {esMia && <span className="bg-autoblue text-white text-[9px] font-black uppercase px-2 py-0.5 rounded mb-1 inline-block">Tu publicación</span>}
                <h3 className="text-lg font-black text-gray-900 leading-tight">{p.nombre_comercial}</h3>
                <p className="text-sm text-gray-500 font-medium">{p.marca}{p.categoria ? ` · ${p.categoria}` : ''}</p>
                <p className="text-xs text-gray-500 mt-1">Vende: <span className="font-bold text-gray-700">{tienda?.nombre || 'Sucursal'}</span></p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-5 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <Dato etiqueta="Número de parte" valor={p.numero_parte} mono />
              <Dato etiqueta="Código de barras" valor={p.codigo_barras} mono />
              <Dato etiqueta="Condición" valor={p.condicion} />
              <Dato etiqueta="Garantía" valor={p.garantia} />
              <Dato etiqueta="Calidad" valor={p.nivel_calidad} />
              <Dato etiqueta="Tipo de vehículo" valor={p.tipo_vehiculo} />
              <div className="col-span-2"><Dato etiqueta="Compatibilidad" valor={compat} /></div>
              {p.descripcion && <div className="col-span-2"><Dato etiqueta="Descripción" valor={p.descripcion} /></div>}
            </div>

            <div className="flex justify-between items-end mt-5">
              <div>
                <p className="text-[10px] uppercase font-black text-gray-500">Precio</p>
                <p className="font-black text-red-600 text-2xl">${item.precio_oferta}</p>
              </div>
              <p className={`font-bold text-xs px-2.5 py-1 rounded ${item.stock === 0 ? 'bg-red-100 text-red-600' : item.stock <= 5 ? 'bg-orange-100 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                Stock: {item.stock}
              </p>
            </div>

            <div className="flex gap-2 mt-6">
              {esMia ? (
                <button type="button" onClick={() => onEditar(item)} className="flex-1 px-4 py-2.5 bg-autoblue text-white font-bold rounded-xl text-sm hover:bg-blue-900 cursor-pointer">
                  Editar pieza
                </button>
              ) : (
                <Link to={`/producto/${item.id}`} className="flex-1 px-4 py-2.5 bg-autoblue text-white font-bold rounded-xl text-sm hover:bg-blue-900 text-center">
                  Ver publicación completa
                </Link>
              )}
              <button type="button" onClick={onCerrar} className="px-4 py-2.5 bg-gray-100 font-bold rounded-xl text-sm hover:bg-gray-200 cursor-pointer">
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
