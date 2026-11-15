import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useScanner from '../hooks/useScanner';
import useEsTienda from '../hooks/useEsTienda';
import { extraerIdInventario, pareceEnlaceAutoRed } from '../utils/qrAutoRed';

/**
 * Escáner de mano (USB/Bluetooth) para usuarios TIENDA, en cualquier página de la app:
 * si lee un QR de AutoRed (https://.../producto/<id>), abre la página de esa pieza,
 * igual que al escanearlo con la cámara del celular.
 * Los códigos de barras normales se ignoran aquí.
 *
 * Si el QR parece de AutoRed pero no se logra leer el id (por ejemplo, por la distribución del
 * teclado de la pistola), muestra un aviso con lo que se leyó, para poder corregirlo.
 *
 * En Mi Mostrador (/dashboard/store) el escáner lo maneja StoreDashboard, que tiene sus propios modos.
 */
export default function EscanerRedireccion() {
  const { esTienda } = useEsTienda();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const enMiMostrador = pathname.startsWith('/dashboard/store');
  const [aviso, setAviso] = useState('');
  const temporizador = useRef(null);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const mostrarAviso = (texto) => {
    setAviso(texto);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAviso(''), 6000);
  };

  useScanner(
    (codigo) => {
      const id = extraerIdInventario(codigo);
      if (id) {
        navigate(`/producto/${id}`);
      } else if (pareceEnlaceAutoRed(codigo)) {
        mostrarAviso(`No pude interpretar ese QR. Se leyó: "${codigo.slice(0, 60)}"`);
      }
    },
    { enabled: esTienda && !enMiMostrador }
  );

  if (!aviso) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 max-w-[90vw]">
      <div className="bg-red-600 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-2xl break-all">
        {aviso}
      </div>
    </div>
  );
}