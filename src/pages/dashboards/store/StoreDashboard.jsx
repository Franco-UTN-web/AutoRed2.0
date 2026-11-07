import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/supabase';
import GestorExcel from './components/GestorExcel';

// --- DICCIONARIOS LOCALES ---
const vehiculosDb = {
  "Nissan": ["Versa", "Sentra", "Tsuru", "March", "NP300", "Kicks", "Tiida"],
  "Volkswagen": ["Jetta", "Golf", "Vento", "Polo", "Saveiro", "Tiguan", "Vocho"],
  "Chevrolet": ["Chevy", "Aveo", "Spark", "Silverado", "Beat", "Tracker", "Onix"],
  "Ford": ["Fiesta", "Focus", "Figo", "Ranger", "Explorer", "F-150", "Mustang"],
  "Toyota": ["Yaris", "Corolla", "Camry", "Hilux", "RAV4", "Avanza"],
  "Honda": ["Civic", "City", "CR-V", "Accord", "HR-V"],
  "Universal": ["Aplica para cualquier modelo"]
};

const aniosDisponibles = ["Todos los años", ...Array.from(new Array(37), (val, index) => (new Date().getFullYear() + 1) - index).map(String)];

const marcasRefacciones = [
  "ACDelco", "Bardahl", "Boge", "Bosch", "Brembo", "Castrol", 
  "Dai", "Fritec", "Gates", "Genérica", "Gonher", "KYB", 
  "LUK", "NGK", "Roshfrans", "Valeo", "Wagner", "Mobil", "Purolator"
];

export default function StoreDashboard() {
  
  // 1. LECTURA DEL USUARIO
  let usuarioLogueado = null;
  try {
    const datosUsuarioJson = localStorage.getItem('user_data');
    if (datosUsuarioJson && datosUsuarioJson !== "undefined") {
      usuarioLogueado = JSON.parse(datosUsuarioJson);
    }
  } catch (error) {
    console.warn("Datos de usuario corruptos, usando sesión de respaldo.");
  }
  
  // 2. ESTADOS GENERALES
  const [miEstablecimiento, setMiEstablecimiento] = useState(null);
  const [activeTab, setActiveTab] = useState('catalog');
  const [showForm, setShowForm] = useState(false);
  const [inventarioLocal, setInventarioLocal] = useState([]);
  const [inventarioGlobal, setInventarioGlobal] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [imagenSeleccionada, setImagenSeleccionada] = useState(null);
  const [idEdicion, setIdEdicion] = useState(null);

  const navigate = useNavigate();

  // 3. ESTADOS DE UI ANIMADA
  const [notificacion, setNotificacion] = useState({ visible: false, mensaje: '', tipo: 'exito' });
  const [modalEliminar, setModalEliminar] = useState({ visible: false, idProducto: null });

  // 4. ESTADO DEL FORMULARIO
  const [formData, setFormData] = useState({
    categoria: 'Motor', marca: '', nombre_comercial: '', descripcion: '',
    fabricante_original: '', nivel_calidad: 'Premium', tiempo_duracion: '',
    stock: 1, precio_lista: 0, precio_oferta: 0, establecimiento_id: '',
    tipo_vehiculo: 'Auto', marca_vehiculo: '', modelo: '', anio_vehiculo: '', imagen_url: '',
    numero_parte: '', condicion: 'Nueva', garantia: 'Sin garantía'
  });

  const mostrarNotificacion = (mensaje, tipo = 'exito') => {
    setNotificacion({ visible: true, mensaje, tipo });
    setTimeout(() => setNotificacion({ visible: false, mensaje: '', tipo: 'exito' }), 3500);
  };

  const inicializarPanel = async () => {
    if (!usuarioLogueado) return;
    setCargando(true);
    try {
      // 1. Obtener establecimiento del usuario
      const { data: tienda, error: errTienda } = await supabase
        .from('establecimientos')
        .select('*')
        .eq('propietario_id', usuarioLogueado.id)
        .maybeSingle();

      if (errTienda) throw errTienda;

      if (tienda) {
        setMiEstablecimiento(tienda);
        setFormData(prev => ({ ...prev, establecimiento_id: tienda.id }));

        // 2. Cargar inventario local, global y cotizaciones en paralelo desde Supabase
        const [localRes, globalRes, cotRes] = await Promise.all([
          supabase
            .from('productos')
            .select(`
              *,
              pieza:piezas(*)
            `)
            .eq('establecimiento_id', tienda.id),
          supabase
            .from('productos')
            .select(`
              *,
              pieza:piezas(*),
              establecimiento:establecimientos(*)
            `),
          supabase
            .from('cotizaciones')
            .select('*')
            .eq('establecimiento_id', tienda.id)
        ]);

        if (localRes.error) console.error("Error inventario local:", localRes.error);
        else setInventarioLocal(localRes.data || []);

        if (globalRes.error) console.error("Error inventario global:", globalRes.error);
        else setInventarioGlobal(globalRes.data || []);

        if (cotRes.error) console.warn("Tabla cotizaciones no configurada o vacía:", cotRes.error.message);
        else setCotizaciones(cotRes.data || []);
      }
    } catch (error) {
      console.error("Error al inicializar panel:", error);
      mostrarNotificacion("Error al conectar con Supabase", "error");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    inicializarPanel();
  }, []);

  const cargarDatosParaEdicion = (item) => {
    setIdEdicion(item.id);
    setImagenSeleccionada(null);
    setFormData({
      categoria: item.pieza?.categoria || 'Motor', 
      marca: item.pieza?.marca || '',
      nombre_comercial: item.pieza?.nombre_comercial || '', 
      descripcion: item.pieza?.descripcion || '',
      nivel_calidad: item.pieza?.nivel_calidad || 'Premium', 
      stock: item.stock || 1,
      precio_lista: item.precio_lista || 0, 
      precio_oferta: item.precio_oferta || 0,
      establecimiento_id: miEstablecimiento?.id, 
      tipo_vehiculo: item.pieza?.tipo_vehiculo || 'Auto',
      marca_vehiculo: item.pieza?.marca_vehiculo || '', 
      modelo: item.pieza?.modelo || '',
      anio_vehiculo: item.pieza?.anio_vehiculo || '', 
      imagen_url: item.pieza?.imagen_url || '',
      numero_parte: item.pieza?.numero_parte || '', 
      condicion: item.pieza?.condicion || 'Nueva',
      garantia: item.pieza?.garantia || 'Sin garantía'
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'marca_vehiculo') newData.modelo = '';
      return newData;
    });
  };

  const confirmarEliminacion = (id) => {
    setModalEliminar({ visible: true, idProducto: id });
  };

  const ejecutarEliminacion = async () => {
    const id = modalEliminar.idProducto;
    setModalEliminar({ visible: false, idProducto: null });
    try {
      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      mostrarNotificacion("Producto eliminado del inventario.");
      inicializarPanel();
    } catch (error) {
      mostrarNotificacion("Error al eliminar producto: " + error.message, "error");
    }
  };

  const subirImagenASupabase = async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `refacciones/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('documentos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!miEstablecimiento) {
      mostrarNotificacion("Error: No se encontró tu tienda.", "error");
      return;
    }

    try {
      let urlFinalImagen = formData.imagen_url;
      if (imagenSeleccionada) {
        mostrarNotificacion("Subiendo imagen a Supabase Storage...");
        urlFinalImagen = await subirImagenASupabase(imagenSeleccionada);
      }

      if (idEdicion) {
        // ACTUALIZACIÓN DE PRODUCTO EXISTENTE
        const productoEdicion = inventarioLocal.find(p => p.id === idEdicion);
        
        if (productoEdicion && productoEdicion.pieza_id) {
          // 1. Actualizar datos en la tabla piezas
          const { error: errPieza } = await supabase
            .from('piezas')
            .update({
              categoria: formData.categoria,
              marca: formData.marca,
              nombre_comercial: formData.nombre_comercial,
              descripcion: formData.descripcion,
              nivel_calidad: formData.nivel_calidad,
              tipo_vehiculo: formData.tipo_vehiculo,
              marca_vehiculo: formData.marca_vehiculo,
              modelo: formData.modelo,
              anio_vehiculo: formData.anio_vehiculo,
              imagen_url: urlFinalImagen,
              numero_parte: formData.numero_parte,
              condicion: formData.condicion,
              garantia: formData.garantia
            })
            .eq('id', productoEdicion.pieza_id);

          if (errPieza) throw errPieza;
        }

        // 2. Actualizar datos en la tabla productos
        const { error: errProd } = await supabase
          .from('productos')
          .update({
            stock: formData.stock,
            precio_lista: formData.precio_lista,
            precio_oferta: formData.precio_oferta
          })
          .eq('id', idEdicion);

        if (errProd) throw errProd;

        mostrarNotificacion("¡Producto actualizado correctamente!");
      } else {
        // ALTA DE NUEVO PRODUCTO
        // 1. Crear registro en la tabla piezas
        const { data: nuevaPieza, error: errPieza } = await supabase
          .from('piezas')
          .insert([{
            categoria: formData.categoria,
            marca: formData.marca,
            nombre_comercial: formData.nombre_comercial,
            descripcion: formData.descripcion,
            nivel_calidad: formData.nivel_calidad,
            tipo_vehiculo: formData.tipo_vehiculo,
            marca_vehiculo: formData.marca_vehiculo,
            modelo: formData.modelo,
            anio_vehiculo: formData.anio_vehiculo,
            imagen_url: urlFinalImagen,
            numero_parte: formData.numero_parte,
            condicion: formData.condicion,
            garantia: formData.garantia
          }])
          .select()
          .single();

        if (errPieza) throw errPieza;

        // 2. Crear relación en la tabla productos
        const { error: errProd } = await supabase
          .from('productos')
          .insert([{
            establecimiento_id: miEstablecimiento.id,
            pieza_id: nuevaPieza.id,
            stock: formData.stock,
            precio_lista: formData.precio_lista,
            precio_oferta: formData.precio_oferta
          }]);

        if (errProd) throw errProd;

        mostrarNotificacion("¡Refacción guardada exitosamente!");
      }

      setShowForm(false);
      setIdEdicion(null);
      setImagenSeleccionada(null);
      setFormData({
        categoria: 'Motor', marca: '', nombre_comercial: '', descripcion: '', fabricante_original: '',
        nivel_calidad: 'Premium', tiempo_duracion: '', stock: 1, precio_lista: 0, precio_oferta: 0,
        establecimiento_id: miEstablecimiento.id, tipo_vehiculo: 'Auto', marca_vehiculo: '', modelo: '', anio_vehiculo: '', imagen_url: '',
        numero_parte: '', condicion: 'Nueva', garantia: 'Sin garantía'
      });
      inicializarPanel();
    } catch (error) {
      mostrarNotificacion("Error: " + error.message, "error");
    }
  };

  return (
    <div className="py-10 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ENCABEZADO DINÁMICO */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-4 border-b border-gray-200 gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Mostrador Digital</h1>
            <p className="text-gray-500 font-medium mt-1">
              {cargando ? 'Cargando tu sucursal...' : (miEstablecimiento?.nombre || 'Mi Refaccionaria')} — <span className="text-autoblue font-bold">Sucursal Activa</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
              Terminal Sincronizada (Supabase)
            </span>
          </div>
        </div>

        {/* PESTAÑAS */}
        <div className="flex border-b border-gray-200 mb-6 gap-4 overflow-x-auto">
          <button onClick={() => setActiveTab('orders')} className={`py-3 px-4 text-sm font-bold border-b-2 whitespace-nowrap cursor-pointer ${activeTab === 'orders' ? 'border-autoblue text-autoblue' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Cotizaciones Entrantes ({cotizaciones.length})
          </button>
          <button onClick={() => setActiveTab('catalog')} className={`py-3 px-4 text-sm font-bold border-b-2 whitespace-nowrap cursor-pointer ${activeTab === 'catalog' ? 'border-autoblue text-autoblue' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Mi Inventario Local ({inventarioLocal.length})
          </button>
          <button onClick={() => setActiveTab('global')} className={`py-3 px-4 text-sm font-bold border-b-2 whitespace-nowrap cursor-pointer ${activeTab === 'global' ? 'border-autoblue text-autoblue' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Explorar Competencia
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL: COTIZACIONES ENTRANTES */}
        {activeTab === 'orders' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
            <h3 className="font-bold text-lg text-gray-900 mb-1">Cotizaciones Entrantes</h3>
            <p className="text-sm text-gray-500 mb-6 font-medium">
              Solicitudes de presupuesto enviadas por clientes y talleres de la red.
            </p>

            {cotizaciones.length === 0 ? (
              <div className="p-12 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h4 className="font-bold text-gray-800 text-base mb-1">No tienes cotizaciones pendientes</h4>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Las solicitudes de refacciones enviadas por los compradores de tu zona aparecerán aquí automáticamente.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 font-bold text-xs uppercase border-b border-gray-200">
                    <tr>
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Refacción Solicitada</th>
                      <th className="p-4">Vehículo</th>
                      <th className="p-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cotizaciones.map((cot) => (
                      <tr key={cot.id} className="hover:bg-gray-50">
                        <td className="p-4 font-bold text-gray-900">{cot.cliente_nombre || 'Comprador AutoRed'}</td>
                        <td className="p-4 text-gray-700">{cot.pieza_nombre || 'Sin especificar'}</td>
                        <td className="p-4 text-gray-500">{cot.vehiculo || 'N/A'}</td>
                        <td className="p-4 text-right">
                          <button className="bg-autoblue hover:bg-blue-900 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors">
                            Responder
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

        {/* CONTENIDO PRINCIPAL: INVENTARIO LOCAL */}
        {activeTab === 'catalog' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-gray-900">Gestión de Stock</h3>
              <button onClick={() => {
                setShowForm(!showForm);
                if(showForm) setIdEdicion(null);
              }} className={`border-2 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 cursor-pointer ${showForm ? 'border-gray-300 text-gray-500' : 'border-autoblue text-autoblue hover:bg-blue-50'}`}>
                {showForm ? 'Cancelar' : '+ Agregar Nueva Pieza'}
              </button>
            </div>

            {!showForm && miEstablecimiento && (
              <GestorExcel 
                establecimientoId={miEstablecimiento.id} 
                onUploadSuccess={inicializarPanel} 
              />
            )}

            {/* FORMULARIO DE ALTA / EDICIÓN */}
            {showForm && (
              <form onSubmit={handleSubmit} className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 space-y-6 shadow-inner border-t-4 border-t-autoblue">

                {/* SECCIÓN 1: DATOS DE LA REFACCIÓN */}
                <div>
                  <h4 className="text-sm font-bold text-autoblue mb-3 border-b pb-1">1. Datos de la Refacción</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Tipo de Pieza</label>
                      <select name="categoria" value={formData.categoria} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm">
                        <option value="Motor">Motor (Bujías, Bandas)</option>
                        <option value="Suspensión">Suspensión y Dirección</option>
                        <option value="Frenos">Frenos</option>
                        <option value="Transmisión">Transmisión</option>
                        <option value="Filtros">Filtros</option>
                        <option value="Eléctrico">Eléctrico</option>
                        <option value="Carrocería">Carrocería</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Marca de la Pieza</label>
                      <select name="marca" value={formData.marca} onChange={handleInputChange} required className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm">
                        <option value="">Selecciona marca...</option>
                        {marcasRefacciones.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Nombre Comercial</label>
                      <input type="text" name="nombre_comercial" value={formData.nombre_comercial} onChange={handleInputChange} required className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm" placeholder="Ej. Balatas" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Número de Parte / OEM</label>
                      <input type="text" name="numero_parte" value={formData.numero_parte} onChange={handleInputChange} required className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm uppercase" placeholder="Ej. 06H-103-483-D" />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Condición de la Pieza</label>
                      <select name="condicion" value={formData.condicion} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm">
                        <option value="Nueva">Nueva (Caja sellada)</option>
                        <option value="Usada">Usada (Buen estado/Yonke)</option>
                        <option value="Reconstruida">Reconstruida (Remanufacturada)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Garantía del Vendedor</label>
                      <select name="garantia" value={formData.garantia} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm">
                        <option value="Sin garantía">Sin garantía</option>
                        <option value="15 días">15 días (Piezas eléctricas/Yonke)</option>
                        <option value="1 mes">1 mes</option>
                        <option value="3 meses">3 meses</option>
                        <option value="6 meses">6 meses</option>
                        <option value="1 año">1 año (Fábrica)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECCIÓN 2: COMPATIBILIDAD */}
                <div>
                  <h4 className="text-sm font-bold text-autoblue mb-3 border-b pb-1">2. Compatibilidad del Vehículo</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Tipo de Vehículo</label>
                      <select name="tipo_vehiculo" value={formData.tipo_vehiculo} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm">
                        <option value="Auto">Auto / Sedán</option>
                        <option value="Camioneta">Camioneta / SUV</option>
                        <option value="Motocicleta">Motocicleta</option>
                        <option value="Universal">Universal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Marca Vehículo</label>
                      <select name="marca_vehiculo" value={formData.marca_vehiculo} onChange={handleInputChange} required className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm">
                        <option value="">Selecciona marca...</option>
                        {Object.keys(vehiculosDb).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Modelo</label>
                      <select name="modelo" value={formData.modelo} onChange={handleInputChange} required disabled={!formData.marca_vehiculo} className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm disabled:bg-gray-100">
                        <option value="">Selecciona modelo...</option>
                        {formData.marca_vehiculo && vehiculosDb[formData.marca_vehiculo].map(mod => <option key={mod} value={mod}>{mod}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Año</label>
                      <select name="anio_vehiculo" value={formData.anio_vehiculo} onChange={handleInputChange} required className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm">
                        <option value="">Selecciona año...</option>
                        {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECCIÓN 3: PRECIOS Y FOTO */}
                <div>
                  <h4 className="text-sm font-bold text-autoblue mb-3 border-b pb-1">3. Precios y Multimedia</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Stock</label>
                      <input type="number" name="stock" min="0" step="1" value={formData.stock} onChange={handleInputChange} required className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Precio Compra ($)</label>
                      <input type="number" name="precio_lista" min="0" step="0.01" value={formData.precio_lista} onChange={handleInputChange} required className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Precio Venta ($)</label>
                      <input type="number" name="precio_oferta" min="0" step="0.01" value={formData.precio_oferta} onChange={handleInputChange} required className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-500 mb-1">Calidad</label>
                      <select name="nivel_calidad" value={formData.nivel_calidad} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm">
                        <option value="Premium">Premium</option>
                        <option value="Original OEM">Original OEM</option>
                        <option value="Económica">Económica</option>
                        <option value="Genérica">Genérica</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">Fotografía (Opcional)</label>
                    <input type="file" accept="image/*" onChange={(e) => setImagenSeleccionada(e.target.files[0])} className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm" />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <button type="submit" className="bg-autoblue hover:bg-blue-900 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition-colors cursor-pointer">
                    {idEdicion ? 'Actualizar Producto en BD' : 'Sincronizar a Base de Datos'}
                  </button>
                </div>
              </form>
            )}

            {/* MAPEO DE TARJETAS LOCALES */}
            {cargando ? (
              <div className="p-8 text-center text-gray-500 font-bold animate-pulse">Cargando tu inventario...</div>
            ) : inventarioLocal.length === 0 ? (
              <div className="p-8 text-center text-gray-500 border-2 border-dashed rounded-xl">Tu mostrador está vacío. Agrega tu primer producto.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventarioLocal.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4 flex flex-col justify-between hover:border-autoblue transition-colors group bg-gray-100 shadow-sm">
                    <div className="flex gap-4">
                      {item.pieza?.imagen_url ? (
                        <img src={item.pieza.imagen_url} alt={item.pieza.nombre_comercial} className="w-16 h-16 object-cover rounded-lg border border-gray-100 bg-gray-50" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-white flex items-center justify-center text-gray-400 font-black text-xl border border-gray-200">
                          {item.pieza?.nombre_comercial?.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 group-hover:text-autoblue transition-colors">{item.pieza?.nombre_comercial}</p>
                        <p className="text-gray-500 text-xs mt-1 font-medium">{item.pieza?.marca} {item.pieza?.modelo}</p>
                        
                        {item.pieza?.numero_parte && (
                          <p className="text-[10px] text-autoblue font-mono bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded mt-1 w-max">
                            PN: {item.pieza.numero_parte}
                          </p>
                        )}

                        <div className="mt-2 flex items-center gap-2">
                          <p className={`font-bold text-xs px-2 py-0.5 rounded inline-block ${item.stock === 0 ? 'bg-red-100 text-red-600' : item.stock <= 5 ? 'bg-orange-100 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                            Stock: {item.stock}
                          </p>
                          {item.pieza?.condicion && (
                            <span className="text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                              {item.pieza.condicion}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-end">
                      <div>
                        <p className="text-[10px] uppercase font-black text-gray-500">Precio Oferta</p>
                        <p className="font-black text-red-600 text-lg">${item.precio_oferta}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => cargarDatosParaEdicion(item)} className="text-blue-600 bg-white border border-gray-200 hover:bg-blue-50 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer">
                          Editar
                        </button>
                        <button onClick={() => confirmarEliminacion(item.id)} className="text-red-600 bg-white border border-gray-200 hover:bg-red-50 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer">
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONTENIDO PRINCIPAL: CATÁLOGO GLOBAL */}
        {activeTab === 'global' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
            <h3 className="font-bold text-lg text-gray-900 mb-1">Catálogo Global</h3>
            <p className="text-sm text-gray-500 mb-6 font-medium">Monitorea los precios del mercado y administra tus propias publicaciones.</p>

            {cargando ? (
              <div className="p-8 text-center text-gray-500 font-bold animate-pulse">Cargando catálogo mundial...</div>
            ) : inventarioGlobal.length === 0 ? (
              <div className="p-8 text-center text-gray-500 border-2 border-dashed rounded-xl">El catálogo global está vacío.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventarioGlobal.map((item) => {
                  const esMia = miEstablecimiento && item.establecimiento_id === miEstablecimiento.id;
                  return (
                    <div key={item.id} className={`border rounded-lg p-4 flex flex-col justify-between transition-colors shadow-sm ${esMia ? 'border-autoblue bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                      <div className="flex gap-4">
                        {item.pieza?.imagen_url ? (
                          <img src={item.pieza.imagen_url} alt={item.pieza.nombre_comercial} className="w-16 h-16 object-cover rounded-lg border border-gray-100 bg-gray-50" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-black text-xl border border-gray-200">
                            {item.pieza?.nombre_comercial?.charAt(0)}
                          </div>
                        )}
                        <div>
                          {esMia && <span className="bg-autoblue text-white text-[9px] font-black uppercase px-2 py-0.5 rounded mb-1 inline-block">Tu Publicación</span>}
                          <p className="font-bold text-gray-900 text-sm leading-tight line-clamp-2">{item.pieza?.nombre_comercial}</p>
                          <p className="text-gray-500 text-xs mt-1 font-medium">{item.pieza?.marca} {item.pieza?.modelo}</p>
                          
                          {item.pieza?.numero_parte && (
                            <p className="text-[10px] text-gray-500 font-mono mt-1">
                              No. Parte: {item.pieza.numero_parte}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className={`mt-4 pt-4 border-t flex justify-between items-end ${esMia ? 'border-blue-200' : 'border-gray-100'}`}>
                        <div>
                          <p className="text-[10px] uppercase font-black text-gray-500">Precio Público</p>
                          <p className="font-black text-gray-900 text-lg">${item.precio_oferta}</p>
                        </div>
                        
                        {esMia ? (
                          <button 
                            onClick={() => { setActiveTab('catalog'); cargarDatosParaEdicion(item); }} 
                            className="text-autoblue bg-white border border-autoblue hover:bg-blue-100 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                          >
                            Editar Mi Pieza
                          </button>
                        ) : (
                          <Link 
                            to={`/producto/${item.id}`} 
                            className="text-gray-600 bg-gray-100 border border-gray-200 hover:bg-gray-200 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
                          >
                            Ver Competencia
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MODAL Y NOTIFICACIÓN */}
        <div className={`fixed top-24 left-1/2 z-[100] transform -translate-x-1/2 transition-all duration-500 ${notificacion.visible ? 'translate-y-0 opacity-100' : '-translate-y-12 opacity-0 pointer-events-none'}`}>
          <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl text-white font-bold ${notificacion.tipo === 'exito' ? 'bg-green-600' : 'bg-red-600'}`}>
            {notificacion.mensaje}
          </div>
        </div>

        {modalEliminar.visible && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl transform transition-all">
              <h3 className="text-xl font-black text-center text-gray-900 mb-2">¿Eliminar refacción?</h3>
              <p className="text-center text-gray-500 text-sm mb-8 font-medium">Esta acción es permanente.</p>
              <div className="flex gap-3">
                <button onClick={() => setModalEliminar({ visible: false, idProducto: null })} className="flex-1 px-4 py-3 bg-gray-100 font-bold rounded-xl hover:bg-gray-200">Cancelar</button>
                <button onClick={ejecutarEliminacion} className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">Sí, eliminar</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}