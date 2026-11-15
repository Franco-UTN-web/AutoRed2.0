import { useLocation, useNavigate } from 'react-router-dom';
import useScanner from '../hooks/useScanner';
import useEsTienda from '../hooks/useEsTienda';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Escáner de mano (USB/Bluetooth) para usuarios TIENDA, en cualquier página de la app:
 * si lee un QR de AutoRed (https://.../producto/<id>), abre la página de esa pieza,
 * igual que al escanearlo con la cámara del celular.
 * Los códigos de barras normales se ignoran aquí.
 *
 * En Mi Mostrador (/dashboard/store) el escáner lo maneja StoreDashboard, que tiene sus propios modos.
 * No se monta nada visible: solo escucha el teclado.
 */
export default function EscanerRedireccion() {
  const { esTienda } = useEsTienda();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const enMiMostrador = pathname.startsWith('/dashboard/store');

  useScanner(
    (codigo) => {
      const m = codigo.match(UUID_RE);
      if (m) navigate(`/producto/${m[0].toLowerCase()}`);
    },
    { enabled: esTienda && !enMiMostrador }
  );

  return null;
}
