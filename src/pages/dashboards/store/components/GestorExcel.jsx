import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/supabase'; // Ajusta la ruta si usas '../../supabase'

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

      // 2. Detectar dinámicamente la fila donde empiezan los encabezados reales (saltando el logo)
      const matrizFilas = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const indiceEncabezado = matrizFilas.findIndex((fila) =>
        Array.isArray(fila) &&
        fila.some((celda) =>
          String(celda || '').toLowerCase().includes('nombre comercial')
        )
      );

      // Si encuentra "Nombre Comercial" en la fila 2 (índice 1), lee desde ahí; si no, usa la fila 1 (índice 0)
      const filas = XLSX.utils.sheet_to_json(sheet, {
        range: indiceEncabezado >= 0 ? indiceEncabezado : 0,
        defval: ''
      });

      if (!filas || filas.length === 0) {
        setMensaje('El archivo Excel está vacío o no tiene el formato esperado.');
        setCargando(false);
        return;
      }

      let procesadosExitosos = 0;
      let erroresFila = 0;

      // 3. Iterar filas e insertar en Supabase
      for (const fila of filas) {
        // Normalizar llaves (eliminar espacios extra) para evitar fallos de lectura
        const row = {};
        for (const key of Object.keys(fila)) {
          row[key.trim()] = fila[key];
        }

        // Mapear columnas exactamente como vienen en plantilla_autored.xlsx
        const categoria =
          row['Tipo de Pieza (Categoría)'] || row['Categoría'] || row['categoria'] || 'Motor';
        const marca =
          row['Marca de la Pieza'] || row['Marca'] || row['marca'] || '';
        const nombre_comercial =
          row['Nombre Comercial'] || row['nombre_comercial'] || '';
        const numero_parte = String(
          row['Número de Parte'] || row['Número de Parte / OEM'] || row['numero_parte'] || ''
        );
        const condicion =
          row['Condición'] || row['condicion'] || 'Nueva';
        const garantia =
          row['Garantía'] || row['garantia'] || 'Sin garantía';
        const tipo_vehiculo =
          row['Tipo de Vehículo'] || row['Tipo Vehículo'] || row['tipo_vehiculo'] || 'Auto';
        const marca_vehiculo =
          row['Marca Vehículo'] || row['marca_vehiculo'] || '';
        const modelo =
          row['Modelo'] || row['modelo'] || '';
        const anio_vehiculo = String(
          row['Año'] || row['Año Vehículo'] || row['anio_vehiculo'] || ''
        );
        const descripcion =
          row['Descripción'] || row['descripcion'] || '';
        const nivel_calidad =
          row['Nivel Calidad'] || row['Calidad'] || row['nivel_calidad'] || 'Premium';
        const imagen_url =
          row['URL Imagen'] || row['imagen_url'] || '';

        const stock = parseInt(row['Stock'] || row['stock'] || 1, 10) || 0;
        const precio_lista = parseFloat(
          row['Precio Lista'] || row['Precio Compra'] || row['precio_lista'] || 0
        ) || 0;
        const precio_oferta = parseFloat(
          row['Precio Oferta'] || row['Precio Venta'] || row['precio_oferta'] || 0
        ) || 0;

        // Saltar filas vacías o sin los datos mínimos requeridos
        if (!nombre_comercial.toString().trim() || !marca.toString().trim()) {
          continue;
        }

        // Generar UUIDs garantizados antes de insertar
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
            anio_vehiculo: anio_vehiculo.trim(),
            numero_parte: numero_parte.trim(),
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
        setMensaje('Error: No se pudo registrar ninguna fila. Verifica que las columnas "Nombre Comercial" y "Marca de la Pieza" tengan datos.');
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
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-all shadow-sm cursor-pointer"
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
          className="w-full sm:w-auto bg-autoblue text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-blue-800 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
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