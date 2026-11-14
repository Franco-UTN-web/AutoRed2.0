import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

// Escapa texto antes de meterlo en la ventana de impresión
const esc = (t = '') =>
  String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Muestra el QR de una pieza del inventario.
 * El QR contiene la URL pública de la pieza: https://tu-sitio/producto/<id del inventario>
 *  - Con la cámara de cualquier celular abre la página de la pieza.
 *  - Con el escáner de AutoRed (cámara o lector USB) se extrae el id y se consulta Supabase.
 *
 * item = { id, nombre, marca, numero_parte }
 */
export default function EtiquetaQR({ item, onCerrar }) {
  const canvasRef = useRef(null);
  const url = `${window.location.origin}/producto/${item.id}`;
  const nombreArchivo = `qr-${String(item.numero_parte || item.id).replace(/[^a-z0-9-_]/gi, '_')}.png`;

  const descargar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const enlace = document.createElement('a');
    enlace.href = canvas.toDataURL('image/png');
    enlace.download = nombreArchivo;
    enlace.click();
  };

  const imprimir = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ventana = window.open('', '_blank', 'width=420,height=560');
    if (!ventana) {
      alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.');
      return;
    }
    ventana.document.write(`<!DOCTYPE html><html><head><title>Etiqueta QR</title>
      <style>
        body{font-family:Arial,sans-serif;text-align:center;margin:0;padding:24px}
        .et{display:inline-block;border:1px dashed #999;padding:16px;border-radius:8px}
        img{width:220px;height:220px}
        .n{font-weight:bold;font-size:14px;margin-top:8px;max-width:240px}
        .p{font-family:monospace;font-size:12px;color:#444;margin-top:4px}
      </style></head><body>
      <div class="et">
        <img src="${canvas.toDataURL('image/png')}" />
        <div class="n">${esc(item.nombre)}</div>
        <div class="p">${esc(item.numero_parte ? 'PN: ' + item.numero_parte : '')}</div>
      </div>
      <script>window.onload = function () { window.print(); };<\/script>
      </body></html>`);
    ventana.document.close();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center">
        <h3 className="text-lg font-black text-gray-900 mb-1">Etiqueta QR de la pieza</h3>
        <p className="text-xs text-gray-500 mb-4">
          Pégala en la caja o en la pieza. Al escanearla se abre su ficha al instante.
        </p>

        <div className="inline-block border border-dashed border-gray-300 rounded-xl p-4 bg-white">
          <QRCodeCanvas
            ref={canvasRef}
            value={url}
            size={256}
            level="M"
            marginSize={2}
            style={{ width: 200, height: 200 }}
          />
          <p className="font-bold text-sm text-gray-900 mt-2 max-w-[220px] mx-auto leading-tight">{item.nombre}</p>
          {item.numero_parte && (
            <p className="text-[11px] font-mono text-gray-500 mt-0.5">PN: {item.numero_parte}</p>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button type="button" onClick={descargar} className="flex-1 px-3 py-2.5 bg-gray-100 font-bold rounded-xl text-sm hover:bg-gray-200 cursor-pointer">
            Descargar PNG
          </button>
          <button type="button" onClick={imprimir} className="flex-1 px-3 py-2.5 bg-autoblue text-white font-bold rounded-xl text-sm hover:bg-blue-900 cursor-pointer">
            Imprimir
          </button>
        </div>
        <button type="button" onClick={onCerrar} className="mt-3 text-sm font-bold text-gray-500 hover:text-gray-700 cursor-pointer">
          Cerrar
        </button>
      </div>
    </div>
  );
}
