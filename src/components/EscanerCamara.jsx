import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const ID_LECTOR = 'lector-camara-autored';

/**
 * Abre la cámara y lee un QR (o un código de barras del fabricante).
 * Al leer algo llama a onResultado(texto) una sola vez; el padre decide qué hacer y cierra este modal.
 * Requiere HTTPS (Vercel lo cumple) o localhost, y que el usuario dé permiso a la cámara.
 * Se usa tanto en el panel de la tienda como en el catálogo del comprador.
 */
export default function EscanerCamara({
  onResultado,
  onCerrar,
  titulo = 'Escanear con la cámara',
  ayuda = 'Apunta al QR de una etiqueta AutoRed o al código de barras de la caja.',
}) {
  const [error, setError] = useState('');
  const yaLeido = useRef(false);
  const cola = useRef(Promise.resolve()); // evita que start/stop se pisen entre sí

  useEffect(() => {
    let cancelado = false;
    const lector = new Html5Qrcode(ID_LECTOR, {
      verbose: false,
      useBarCodeDetectorIfSupported: true, // usa el detector nativo del navegador cuando existe (más rápido con códigos de barras)
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
      ],
    });

    cola.current = cola.current.then(async () => {
      if (cancelado) return;
      try {
        await lector.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 200 } },
          (texto) => {
            if (yaLeido.current) return;
            yaLeido.current = true;
            onResultado(texto);
          },
          () => {} // errores de "no hay código en este cuadro": se ignoran
        );
      } catch (e) {
        if (!cancelado) {
          setError('No se pudo abrir la cámara. Revisa el permiso de cámara del navegador (y que el sitio use HTTPS).');
        }
      }
    });

    return () => {
      cancelado = true;
      cola.current = cola.current.then(async () => {
        try {
          if (lector.isScanning) await lector.stop();
          lector.clear();
        } catch {
          /* ya estaba detenida */
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h3 className="text-lg font-black text-gray-900 mb-1">{titulo}</h3>
        <p className="text-xs text-gray-500 mb-4">{ayuda}</p>

        <div id={ID_LECTOR} className="w-full overflow-hidden rounded-xl bg-gray-900 min-h-[240px]" />

        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}

        <p className="mt-3 text-[11px] text-gray-400">Tip: buena luz y la caja a unos 15–20 cm. Los códigos de barras tardan un poco más que los QR.</p>

        <button type="button" onClick={onCerrar} className="mt-4 w-full px-4 py-2.5 bg-gray-100 font-bold rounded-xl text-sm hover:bg-gray-200 cursor-pointer">
          Cancelar
        </button>
      </div>
    </div>
  );
}
