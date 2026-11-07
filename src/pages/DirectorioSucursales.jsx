import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '../supabase';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const centroPorDefecto = [19.4326, -99.1332];

function RecenterMap({ coordenadas, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (coordenadas && Array.isArray(coordenadas) && coordenadas[0] && coordenadas[1]) {
      map.setView(coordenadas, zoom, { animate: true });
    }
  }, [coordenadas, zoom, map]);
  return null;
}

export default function DirectorioSucursales() {
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  
  const [mapCenter, setMapCenter] = useState(centroPorDefecto);
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState(null);
  const [alertaMapa, setAlertaMapa] = useState('');

  useEffect(() => {
    const fetchSucursales = async () => {
      setCargando(true);
      try {
        const { data, error } = await supabase
          .from('establecimientos')
          .select('*');

        if (error) throw error;

        if (data) {
          const activas = data.filter(tienda => 
            !tienda.estado || 
            tienda.estado === 'APROBADO' || 
            tienda.estado === 'aprobado' || 
            tienda.activo === true
          );
          setSucursales(activas);

          const primeraConCoords = activas.find(t => t.latitud && t.longitud);
          if (primeraConCoords) {
            setMapCenter([parseFloat(primeraConCoords.latitud), parseFloat(primeraConCoords.longitud)]);
          }
        }
      } catch (error) {
        console.error("Error al cargar establecimientos desde Supabase:", error);
      } finally {
        setCargando(false);
      }
    };

    fetchSucursales();
  }, []);

  const ubicarEnMapa = async (tienda) => {
    setTiendaSeleccionada(tienda);
    setAlertaMapa('');
    
    if (tienda.latitud && tienda.longitud) {
      const coordsExactas = [parseFloat(tienda.latitud), parseFloat(tienda.longitud)];
      setMapCenter(coordsExactas);
      return;
    }

    const calle = tienda.calle || '';
    const numero = tienda.numero || '';
    const colonia = tienda.colonia || '';
    const ciudad = tienda.ciudad || tienda.municipio || '';
    const estadoRep = tienda.estado_rep || tienda.estadoRep || '';

    const direccionCompleta = `${calle} ${numero}, ${colonia}, ${ciudad}, ${estadoRep}, México`;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccionCompleta)}`);
      const data = await res.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setMapCenter([lat, lng]);
      } else {
        setAlertaMapa("📍 Tienda antigua sin pin exacto. Mostrando el mapa general.");
      }
    } catch (error) {
      console.error("Error buscando coordenadas:", error);
      setAlertaMapa("Hubo un problema al contactar al servidor de mapas. 🔧");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Directorio de Refaccionarias</h1>
          <p className="text-gray-500 font-medium mt-1">Encuentra la sucursal de AutoRed más cercana a tu taller.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:h-[75vh]">
          
          {/* SUCURSALES */}
          <div className="w-full lg:w-1/3 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col overflow-hidden h-[400px] lg:h-full">
            <div className="p-4 border-b border-gray-100 bg-gray-50 shrink-0">
              <h3 className="font-black text-gray-900">Sucursales Activas ({sucursales.length})</h3>
            </div>
            
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {cargando ? (
                <div className="text-center py-10 text-gray-400 font-bold animate-pulse">Cargando directorio...</div>
              ) : sucursales.length === 0 ? (
                <div className="text-center py-10 text-gray-500 font-medium">No hay sucursales operando en este momento.</div>
              ) : (
                sucursales.map(tienda => {
                  const calle = tienda.calle || '';
                  const numero = tienda.numero || '';
                  const colonia = tienda.colonia || '';
                  const ciudad = tienda.ciudad || tienda.municipio || '';
                  const estadoRep = tienda.estado_rep || tienda.estadoRep || '';
                  const cp = tienda.codigo_postal || tienda.codigoPostal || '';

                  return (
                    <div 
                      key={tienda.id} 
                      onClick={() => ubicarEnMapa(tienda)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${tiendaSeleccionada?.id === tienda.id ? 'border-autoblue bg-blue-50 ring-1 ring-autoblue shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}`}
                    >
                      <h4 className="font-black text-gray-900">{tienda.nombre}</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium line-clamp-2">
                        {calle} #{numero}, Col. {colonia}, {ciudad}, {estadoRep}. CP: {cp}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <span className="flex items-center gap-1 text-autoblue font-bold">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                          Ver en mapa
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* MAPA */}
          <div className="w-full lg:w-2/3 bg-gray-200 border border-gray-200 rounded-2xl shadow-sm relative overflow-hidden z-0 h-[400px] lg:h-full">
            
            {alertaMapa && (
              <div className="absolute top-4 left-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl shadow-xl z-[1000] flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                  <span>{alertaMapa}</span>
                </div>
                <button onClick={() => setAlertaMapa('')} className="text-red-400 hover:text-red-700 p-1">
                  ✕
                </button>
              </div>
            )}

            <MapContainer 
              center={mapCenter} 
              zoom={tiendaSeleccionada ? 16 : 6} 
              style={{ width: '100%', height: '100%' }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              <RecenterMap coordenadas={mapCenter} zoom={tiendaSeleccionada ? 16 : 6} />

              {sucursales.map(t => {
                if (!t.latitud || !t.longitud) return null;
                const pos = [parseFloat(t.latitud), parseFloat(t.longitud)];

                return (
                  <Marker key={`pin-${t.id}`} position={pos} eventHandlers={{ click: () => setTiendaSeleccionada(t) }}>
                    <Popup>
                      <div className="p-1 max-w-[200px] text-center">
                        <h4 className="font-black text-gray-900 text-sm">{t.nombre}</h4>
                        <p className="text-xs text-gray-600 mt-1">{t.calle} #{t.numero}</p>
                        {t.telefono && (
                          <a 
                            href={`https://wa.me/${t.telefono.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="mt-2 text-xs bg-green-500 hover:bg-green-600 text-white font-bold px-2 py-1.5 rounded block transition-colors"
                          >
                            Contactar WhatsApp
                          </a>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm text-[10px] font-bold text-gray-500 pointer-events-none z-[999]">
              Motor: OpenStreetMap
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}