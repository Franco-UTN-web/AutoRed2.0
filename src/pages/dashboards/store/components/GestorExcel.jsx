import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/supabase'; // Ajusta la ruta a tu supabaseClient

export default function GestorExcel({ establecimientoId, onUploadSuccess }) {
  const [archivo, setArchivo] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  const manejarDescarga = () => {
    window.location.href = '/plantilla_autored.xlsx';
  };

  const subirArchivo = async () => {
    if (!archivo) {
      setMensaje('Por favor selecciona un archivo Excel (.xlsx, .xls).');
      return;
    }

    if (!establecimientoId) {
      setMensaje('Error: No se identificó el establecimiento activo.');
      return;
    }

    setCargando(true);
    setMensaje('');

    try {
      // 1. Leer el archivo Excel en el navegador
      const buffer = await archivo.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Convertir la hoja a JSON
      const filas = XLSX.utils.sheet_to_json(sheet);

      if (!filas || filas.length === 0) {
        setMensaje('El archivo Excel está vacío o no tiene el formato esperado.');
        setCargando(false);
        return;
      }

      let procesadosExitosos = 0;
      let erroresFila = 0;

      // 2. Iterar filas e insertar en Supabase
      for (const fila of filas) {
        // Mapear columnas según los encabezados de la plantilla Excel
        const categoria = fila['categoria'] || fila['Categoría'] || 'Motor';
        const marca = fila['marca'] || fila['Marca'] || '';
        const nombre_comercial = fila['nombre_comercial'] || fila['Nombre Comercial'] || '';
        const descripcion = fila['descripcion'] || fila['Descripción'] || '';
        const nivel_calidad = fila['nivel_calidad'] || fila['Nivel Calidad'] || 'Premium';
        const tipo_vehiculo = fila['tipo_vehiculo'] || fila['Tipo Vehículo'] || 'Auto';
        const marca_vehiculo = fila['marca_vehiculo'] || fila['Marca Vehículo'] || '';
        const modelo = fila['modelo'] || fila['Modelo'] || '';
        const anio_vehiculo = String(fila['anio_vehiculo'] || fila['Año'] || '');
        const numero_parte = String(fila['numero_parte'] || fila['Número de Parte'] || '');
        const condicion = fila['condicion'] || fila['Condición'] || 'Nueva';
        const garantia = fila['garantia'] || fila['Garantía'] || 'Sin garantía';
        const imagen_url = fila['imagen_url'] || fila['URL Imagen'] || '';

        const stock = parseInt(fila['stock'] || fila['Stock'] || 0, 10) || 0;
        const precio_lista = parseFloat(fila['precio_lista'] || fila['Precio Lista'] || 0) || 0;
        const precio_oferta = parseFloat(fila['precio_oferta'] || fila['Precio Oferta'] || 0) || 0;

        // Saltar filas sin datos mínimos requeridos
        if (!nombre_comercial.toString().trim() || !marca.toString().trim()) {
          continue;
        }

        // Generar UUIDs antes de insertar
        const nuevoPiezaId = crypto.randomUUID();
        const nuevoInventarioId = crypto.randomUUID();

        // A. Insertar la pieza en la tabla 'piezas'
        const { error: errPieza } = await supabase
          .from('piezas')
          .insert([{
            id: nuevoPiezaId,
            categoria: categoria.toString().trim(),
            marca: marca.toString().trim(),
            nombre_comercial: nombre_comercial.toString().trim(),
            descripcion: descripcion.toString().trim(),
            nivel_calidad: nivel_calidad.toString().trim(),
            tipo_vehiculo: tipo_vehiculo.toString().trim(),
            marca_vehiculo: marca_vehiculo.toString().trim(),
            modelo: modelo.toString().trim(),
            anio_vehiculo,
            numero_parte,
            condicion: condicion.toString().trim(),
            garantia: garantia.toString().trim(),
            imagen_url: imagen_url.toString().trim()
          }]);

        if (errPieza) {
          console.error('Error insertando pieza desde Excel:', errPieza.message);
          erroresFila++;
          continue;
        }

        // B. Crear la relación de inventario en la tabla 'inventarios'
        const { error: errInv } = await supabase
          .from('inventarios')
          .insert([{
            id: nuevoInventarioId,
            establecimiento_id: establecimientoId,
            pieza_id: nuevoPiezaId,
            stock,
            precio_lista,
            precio_oferta
          }]);

        if (errInv) {
          console.error('Error insertando en inventarios desde Excel:', errInv.message);
          erroresFila++;
          continue;
        }

        procesadosExitosos++;
      }

      if (procesadosExitosos > 0) {
        setMensaje(
          `¡Carga masiva completada! Se registraron ${procesadosExitosos} refacciones exitosamente.${
            erroresFila > 0 ? ` (${erroresFila} filas tuvieron error).` : ''
          }`
        );
        setArchivo(null);
        const fileInput = document.getElementById('input-excel-masivo');
        if (fileInput) fileInput.value = '';
        
        if (onUploadSuccess) onUploadSuccess();
      } else {
        setMensaje('Error: No se pudo registrar ninguna fila. Verifica que el Excel tenga las columnas "Nombre Comercial" y "Marca" llenas.');
      }

    } catch (error) {
      console.error('Error procesando Excel:', error);
      setMensaje('Error al leer el archivo Excel: ' + error.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 mb-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="font-bold text-gray-800 text-lg">Carga Masiva de Inventario</h3>
          <p className="text-xs text-gray-500">Sube tus refacciones usando nuestra plantilla de Excel oficial.</p>
        </div>
        <button 
          type="button"
          onClick={manejarDescarga}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-all shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Descargar Plantilla Excel
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
        <input 
          id="input-excel-masivo"
          type="file" 
          accept=".xlsx, .xls"
          onChange={(e) => setArchivo(e.target.files[0])}
          className="w-full sm:flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer"
        />
        <button 
          type="button"
          onClick={subirArchivo}
          disabled={!archivo || cargando}
          className="w-full sm:w-auto bg-autoblue text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-blue-800 transition-all disabled:opacity-50 shadow-sm"
        >
          {cargando ? 'Procesando...' : 'Subir Inventario'}
        </button>
      </div>
      
      {mensaje && (
        <p className={`text-sm font-semibold ${mensaje.toLowerCase().includes('error') ? 'text-red-500' : 'text-green-600'}`}>
          {mensaje}
        </p>
      )}
    </div>
  );
}