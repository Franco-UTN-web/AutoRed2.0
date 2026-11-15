import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

/**
 * QR de una pieza para el comprador (página de detalle del producto).
 * Contiene la URL pública de la pieza: https://tu-sitio/producto/<id del inventario>
 *  - Escaneado con un celular, abre esta misma pieza.
 *  - Mostrado en la tienda, el vendedor lo escanea con AutoRed (lector o cámara) y la encuentra al instante.
 */
export default function QRProducto({ inventarioId, nombre, numeroParte }) {
  const canvasRef = useRef(null);
  const [copiado, setCopiado] = useState(false);

  if (!inventarioId) return null;

  const url = `${window.location.origin}/producto/${inventarioId}`;
  const nombreArchivo = `qr-${String(numeroParte || inventarioId).replace(/[^a-z0-9-_]/gi, '_')}.png`;

  const descargar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const enlace = document.createElement('a');
    enlace.href = canvas.toDataURL('image/png');
    enlace.download = nombreArchivo;
    enlace.click();
  };

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copia este enlace:', url); // respaldo si el navegador no permite el portapapeles
    }
  };

  return (
    <div className="mb-8 bg-gray-50 p-5 rounded-xl border border-gray-100 flex flex-col sm:flex-row items-center gap-5">
      <div className="bg-white p-2 rounded-lg border border-gray-200 flex-shrink-0">
        <QRCodeCanvas
          ref={canvasRef}
          value={url}
          size={256}
          level="M"
          marginSize={1}
          style={{ width: 120, height: 120 }}
          aria-label={`Código QR de ${nombre || 'la pieza'}`}
        />
      </div>

      <div className="text-center sm:text-left">
        <h3 className="font-black text-gray-900 uppercase tracking-wider text-sm mb-1">QR de esta pieza</h3>
        <p className="text-xs text-gray-500 leading-relaxed mb-3">
          Escanéalo con tu celular para llevarte esta pieza contigo, o muéstralo en la tienda para que la encuentren al instante.
        </p>
        <div className="flex flex-wrap justify-center sm:justify-start gap-2">
          <button
            type="button"
            onClick={descargar}
            className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
          >
            Descargar QR
          </button>
          <button
            type="button"
            onClick={copiarEnlace}
            className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
          >
            {copiado ? '¡Enlace copiado!' : 'Copiar enlace'}
          </button>
        </div>
      </div>
    </div>
  );
}
