import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useScanner from '../hooks/useScanner';
import { extraerIdInventario, pareceEnlaceAutoRed } from '../utils/qrAutoRed';

/**
 * Escáner de mano (USB/Bluetooth) en cualquier página de la app y para CUALQUIER usuario
 * (comprador, tienda o sin sesión): si lee un QR de AutoRed (https://.../producto/<id>),
 * abre la página de esa pieza, igual que al escanearlo con la cámara del celular.
 * Los códigos de barras normales se ignoran aquí.
 *
 * Si el QR parece de AutoRed pero no se logra leer el id, muestra un aviso con lo que se leyó.
 *
 * No interfiere con lo que se escribe en campos de texto normales (login, formularios...),
 * salvo en los que se marcan con data-scanner="true" (por ejemplo, el buscador del Catálogo).
 * En Mi Mostrador (/dashboard/store) el escáner lo maneja StoreDashboard, que tiene sus propios modos.
 */
export default function EscanerRedireccion() {
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
    { enabled: !enMiMostrador, respetarCampos: true }
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