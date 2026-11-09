import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { supabase } from '../supabase';

// Categorías rápidas para filtrado por sistema
const CATEGORIAS_RAPIDAS = [
  { id: 'Cualquiera', label: 'Todas las piezas' },
  { id: 'Motor', label: 'Motor' },
  { id: 'Frenos', label: 'Frenos' },
  { id: 'Suspensión', label: 'Suspensión' },
  { id: 'Eléctrico', label: 'Eléctrico' },
  { id: 'Transmisión', label: 'Transmisión' },
  { id: 'Accesorios', label: 'Accesorios' }
];

export default function Catalog() {
  let usuarioLogueado = null;
  let rolUsuario = 'invitado';
  try {
    const datosUsuarioJson = localStorage.getItem('user_data');
    if (datosUsuarioJson && datosUsuarioJson !== "undefined") {
      usuarioLogueado = JSON.parse(datosUsuarioJson);
      rolUsuario = usuarioLogueado?.user_metadata?.role || 'comprador';
    }
  } catch (error) {
    console.warn("Datos de sesión no encontrados.");
  }

  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [miTiendaId, setMiTiendaId] = useState(null); 

  // --- GARAJE VIRTUAL ---
  const [misVehiculos, setMisVehiculos] = useState([]);
  const [filtroMiVehiculo, setFiltroMiVehiculo] = useState(''); 

  // --- COMPARADOR DE PRODUCTOS ---
  const [listaComparacion, setListaComparacion] = useState([]);
  const [modalMatrizAbierto, setModalMatrizAbierto] = useState(false);
  const [alerta, setAlerta] = useState({ visible: false, mensaje: '' });

  const [searchParams] = useSearchParams();

  // Estados dinámicos de búsqueda y filtro
  const [busqueda, setBusqueda] = useState(searchParams.get('q') || '');
  const [filtroMarca, setFiltroMarca] = useState(searchParams.get('marca') || 'Cualquiera');
  const [filtroCategoria, setFiltroCategoria] = useState(searchParams.get('categoria') || 'Cualquiera');
  
  const [precioMax, setPrecioMax] = useState(5000);
  const [orden, setOrden] = useState('relevancia');

  useEffect(() => {
    setBusqueda(searchParams.get('q') || '');
    setFiltroCategoria(searchParams.get('categoria') || 'Cualquiera');
    setFiltroMarca(searchParams.get('marca') || 'Cualquiera');
  }, [searchParams]);
  
  useEffect(() => {
    const inicializarCatalogo = async () => {
      setCargando(true);
      setError(null);
      try {
        // Consultar inventarios con relaciones y establecimientos por separado
        const [resInventario, resEstablecimientos] = await Promise.all([
          supabase.from('inventarios').select(`
            *,
            piezas (*)
          `).order('created_at', { ascending: false }),
          supabase.from('establecimientos').select('*')
        ]);

        const dataEstablecimientos = resEstablecimientos.data || [];
        let itemsNormalizados = [];

        if (resInventario.error) {
          console.warn("Consulta JOIN falló, ejecutando fallback manual:", resInventario.error.message);
          const { data: simpleInv } = await supabase.from('inventarios').select('*');
          const { data: simplePiezas } = await supabase.from('piezas').select('*');

          itemsNormalizados = (simpleInv || []).map(item => ({
            ...item,
            pieza: (simplePiezas || []).find(p => p.id === item.pieza_id) || {},
            tiendaInfo: dataEstablecimientos.find(t => t.id === item.establecimiento_id) || {}
          }));
        } else {
          itemsNormalizados = (resInventario.data || []).map(item => {
            const piezaObj = Array.isArray(item.piezas) ? item.piezas[0] : (item.piezas || {});
            const tiendaObj = dataEstablecimientos.find(t => t.id === item.establecimiento_id || t.id === item.sucursal_id) || {};
            return { 
              ...item, 
              pieza: piezaObj,
              tiendaInfo: tiendaObj 
            };
          });
        }

        setProductos(itemsNormalizados);

        if (usuarioLogueado) {
          const miTienda = dataEstablecimientos.find(t => t.propietario_id === usuarioLogueado.id);
          if (miTienda) setMiTiendaId(miTienda.id);

          if (usuarioLogueado.user_metadata?.role === 'comprador') {
            const { data: vehiculos } = await supabase
              .from('vehiculos_cliente')
              .select('*')
              .eq('usuario_id', usuarioLogueado.id);
            
            if (vehiculos) setMisVehiculos(vehiculos);
          }
        }
      } catch (err) {
        console.error("Error cargando catálogo desde Supabase:", err);
        setError("No se pudieron cargar las refacciones. Verifica tu conexión.");
      } finally {
        setCargando(false);
      }
    };

    inicializarCatalogo();
  }, []);

  const mostrarAlerta = (mensaje) => {
    setAlerta({ visible: true, mensaje });
    setTimeout(() => setAlerta({ visible: false, mensaje: '' }), 3000);
  };

  const toggleComparacion = (producto) => {
    const yaEsta = listaComparacion.find(p => p.id === producto.id);
    if (yaEsta) {
      setListaComparacion(prev => prev.filter(p => p.id !== producto.id));
    } else {
      if (listaComparacion.length >= 3) {
        mostrarAlerta("Solo puedes comparar hasta 3 piezas al mismo tiempo.");
        return;
      }
      const categoriaItem = producto.categoria || producto.pieza?.categoria;
      const categoriaBase = listaComparacion[0]?.categoria || listaComparacion[0]?.pieza?.categoria;

      if (listaComparacion.length > 0 && categoriaBase !== categoriaItem) {
        mostrarAlerta(`Solo puedes comparar piezas de la misma categoría (${categoriaBase}).`);
        return;
      }
      setListaComparacion(prev => [...prev, producto]);
    }
  };

  const productosFiltrados = useMemo(() => {
    let filtrados = productos.filter(item => {
      const nombreComercial = item.nombre || item.pieza?.nombre_comercial || '';
      const marcaFab = item.marca || item.pieza?.marca || '';
      const marcaVeh = item.marca_vehiculo || item.pieza?.marca_vehiculo || '';
      const modeloVeh = item.modelo || item.pieza?.modelo || '';
      const numParte = item.numero_parte || item.pieza?.numero_parte || '';
      const catItem = item.categoria || item.pieza?.categoria || '';
      const precioItem = item.precio_oferta || item.precio || item.precio_lista || 0;
      const activoItem = item.activo !== false && item.pieza?.activo !== false;

      if (!activoItem) return false;

      const vehiculoActivo = misVehiculos.find(v => v.id === filtroMiVehiculo);
      const pasaMiVehiculo = !vehiculoActivo || 
        (marcaVeh.toLowerCase() === vehiculoActivo.marca?.toLowerCase() && 
         modeloVeh.toLowerCase() === vehiculoActivo.modelo?.toLowerCase());

      const textoBusqueda = busqueda.toLowerCase();
      const pasaBusqueda = 
        nombreComercial.toLowerCase().includes(textoBusqueda) ||
        marcaFab.toLowerCase().includes(textoBusqueda) ||
        marcaVeh.toLowerCase().includes(textoBusqueda) ||
        modeloVeh.toLowerCase().includes(textoBusqueda) ||
        numParte.toLowerCase().includes(textoBusqueda);

      const pasaMarca = filtroMarca === 'Cualquiera' || marcaVeh === filtroMarca;
      const pasaCategoria = filtroCategoria === 'Cualquiera' || catItem === filtroCategoria;
      const pasaPrecio = precioItem <= precioMax || precioMax >= 5000;

      return pasaMiVehiculo && pasaBusqueda && pasaMarca && pasaCategoria && pasaPrecio;
    });

    if (orden === 'menor') {
      filtrados.sort((a, b) => (a.precio_oferta || a.precio || 0) - (b.precio_oferta || b.precio || 0));
    } else if (orden === 'mayor') {
      filtrados.sort((a, b) => (b.precio_oferta || b.precio || 0) - (a.precio_oferta || a.precio || 0));
    }

    return filtrados;
  }, [productos, busqueda, filtroMarca, filtroCategoria, precioMax, orden, filtroMiVehiculo, misVehiculos]);

  const limpiarFiltros = () => {
    setBusqueda(''); 
    setFiltroMarca('Cualquiera'); 
    setFiltroCategoria('Cualquiera'); 
    setPrecioMax(5000); 
    setOrden('relevancia'); 
    setFiltroMiVehiculo('');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 py-8 font-sans pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ENCABEZADO */}
        <div className="mb-8 relative overflow-hidden bg-white border border-gray-200 rounded-3xl p-8 sm:p-10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-1.5 bg-autored rounded-full"></span>
              <span className="text-autored font-black uppercase tracking-widest text-xs">GestInventario</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-autoblue tracking-tight mb-2 leading-tight">
              Catálogo de Autopartes
            </h1>
            <p className="text-gray-500 font-medium max-w-xl text-sm sm:text-base mt-3">
              Encuentra la pieza exacta para tu vehículo, compara opciones locales y contacta al vendedor sin intermediarios.
            </p>
          </div>

          <div className="hidden md:block relative">
            <svg className="w-32 h-32 text-blue-50 transform rotate-12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.39 5.81L16.2 3.03a1.98 1.98 0 0 0-1.32-.48H9.12c-.48 0-.95.17-1.32.48L4.61 5.81a2 2 0 0 0-.66 1.33L3 17.5c0 1.38 1.12 2.5 2.5 2.5h13c1.38 0 2.5-1.12 2.5-2.5l-.95-10.36a1.98 1.98 0 0 0-.66-1.33zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"></path>
            </svg>
          </div>
        </div>

        {/* CARRUSEL DE CATEGORÍAS RÁPIDAS */}
        <div className="mb-8 overflow-x-auto hide-scrollbar pb-2">
          <div className="flex gap-3 whitespace-nowrap min-w-max">
            {CATEGORIAS_RAPIDAS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFiltroCategoria(cat.id)}
                className={`px-6 py-2.5 rounded-full text-sm font-bold border transition-all duration-300 ${
                  filtroCategoria === cat.id 
                    ? 'bg-gray-900 text-white border-gray-900 shadow-md transform scale-105' 
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* ALERTA FLOTANTE */}
        <div className={`fixed top-24 left-1/2 z-[100] transform -translate-x-1/2 transition-all duration-300 ${alerta.visible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
          <div className="bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl font-bold text-sm flex items-center gap-2">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {alerta.mensaje}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          
          {/* SIDEBAR DE FILTROS */}
          <div className="w-full md:w-64 flex-shrink-0 space-y-6">
            <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">Búsqueda rápida</h3>
              <input 
                type="text" 
                placeholder="Ej. Bosch, Balatas..." 
                value={busqueda} 
                onChange={(e) => setBusqueda(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-lg pl-3 pr-3 py-2.5 text-sm focus:border-autoblue focus:ring-1 focus:outline-none transition-all" 
              />
            </div>

            <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm sticky top-28">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-4">Filtros</h3>
              <div className="space-y-5">
                
                {misVehiculos.length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg animate-fade-in">
                    <label className="text-[10px] text-autoblue font-black block mb-2 uppercase flex items-center gap-1 tracking-wider">
                      Filtro Inteligente
                    </label>
                    <select 
                      value={filtroMiVehiculo}
                      onChange={(e) => setFiltroMiVehiculo(e.target.value)}
                      className="w-full bg-white border border-blue-200 text-autoblue font-bold rounded-md px-2 py-2 text-xs focus:outline-none shadow-sm cursor-pointer"
                    >
                      <option value="">Ver todo el catálogo</option>
                      {misVehiculos.map(v => (
                        <option key={v.id} value={v.id}>Piezas para mi {v.marca} {v.modelo}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-500 font-bold block mb-2">MARCA DE VEHÍCULO</label>
                  <select value={filtroMarca} onChange={(e) => setFiltroMarca(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-lg px-3 py-2 text-sm focus:border-autoblue focus:outline-none font-medium">
                    <option value="Cualquiera">Cualquiera</option>
                    <option value="Volkswagen">Volkswagen</option>
                    <option value="Nissan">Nissan</option>
                    <option value="Chevrolet">Chevrolet</option>
                    <option value="Ford">Ford</option>
                    <option value="Toyota">Toyota</option>
                    <option value="Honda">Honda</option>
                    <option value="Universal">Universal</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-xs text-gray-500 font-bold block mb-2">TIPO DE PIEZA</label>
                  <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-lg px-3 py-2 text-sm focus:border-autoblue focus:outline-none font-medium">
                    {CATEGORIAS_RAPIDAS.map(cat => (
                      <option key={`select-${cat.id}`} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500 font-bold block mb-2">PRECIO MÁXIMO: <span className="text-autoblue">${precioMax >= 5000 ? '5000+' : precioMax}</span></label>
                  <input type="range" min="100" max="5000" step="100" value={precioMax} onChange={(e) => setPrecioMax(Number(e.target.value))} className="w-full accent-autoblue" />
                </div>
              </div>
              <button onClick={limpiarFiltros} className="w-full bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold border border-gray-200 mt-6 py-2.5 rounded-lg text-sm transition-colors">Limpiar Filtros</button>
            </div>
          </div>

          {/* RESULTADOS */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-gray-600 text-sm font-medium">Mostrando <span className="text-autoblue font-black">{productosFiltrados.length}</span> resultados</p>
              <select value={orden} onChange={(e) => setOrden(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none font-medium">
                <option value="relevancia">Ordenar por: Relevancia</option>
                <option value="menor">Menor a mayor precio</option>
                <option value="mayor">Mayor a menor precio</option>
              </select>
            </div>

            {cargando && (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-200">
                <div className="w-10 h-10 border-4 border-autoblue border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 font-bold text-sm">Cargando autopartes desde Supabase...</p>
              </div>
            )}

            {!cargando && productosFiltrados.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-3xl p-12 sm:p-20 text-center shadow-sm flex flex-col items-center justify-center mt-4">
                <div className="bg-gray-50 p-6 rounded-full mb-6 border border-gray-100 shadow-inner">
                  <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">No encontramos esa pieza</h3>
                <p className="text-gray-500 font-medium max-w-md mx-auto mb-8">
                  No te preocupes. Intenta eliminar algunos filtros o busca por un término más general.
                </p>
                <button 
                  onClick={limpiarFiltros} 
                  className="bg-autoblue hover:bg-blue-900 text-white font-black px-8 py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  Limpiar todos los filtros
                </button>
              </div>
            )}

            {!cargando && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {productosFiltrados.map((item) => (
                  <ProductCard 
                    key={item.id} 
                    item={item} 
                    miTiendaId={miTiendaId} 
                    enComparacion={listaComparacion.some(p => p.id === item.id)}
                    onToggleCompare={() => toggleComparacion(item)}
                    rolUsuario={rolUsuario}
                  />
                ))}
              </div>
            )}

          </div>
        </div>

        {/* BARRA FLOTANTE DE COMPARACIÓN */}
        {listaComparacion.length > 0 && (
          <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] z-40 animate-slide-up">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 text-autoblue w-10 h-10 rounded-full flex items-center justify-center font-black text-lg border border-blue-100">
                  {listaComparacion.length}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Piezas listas para comparar</p>
                  <p className="text-xs text-gray-500 font-medium">Categoría: {listaComparacion[0]?.categoria || listaComparacion[0]?.pieza?.categoria}</p>
                </div>
              </div>

              <div className="flex gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => setListaComparacion([])}
                  className="flex-1 sm:flex-none px-4 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors text-sm"
                >
                  Limpiar
                </button>
                <button 
                  onClick={() => setModalMatrizAbierto(true)}
                  disabled={listaComparacion.length < 2}
                  className="flex-1 sm:flex-none bg-autoblue hover:bg-blue-900 disabled:bg-gray-300 text-white font-bold px-8 py-2.5 rounded-xl text-sm transition-colors shadow-md"
                >
                  {listaComparacion.length < 2 ? 'Selecciona 1 más...' : 'Comparar Ahora'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}