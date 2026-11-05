import React, { useState, useEffect } from 'react';
import { supabase } from '@/supabase';

export default function MiPerfil() {
  const [userId, setUserId] = useState(null);
  
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  
  const [correoActual, setCorreoActual] = useState('');
  const [correo, setCorreo] = useState('');
  const [passwordActual, setPasswordActual] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  useEffect(() => {
    obtenerDatosUsuario();
  }, []);

  const obtenerDatosUsuario = async () => {
    try {
      let currentId = null;
      let currentEmail = '';

      // 1. Intentar obtener desde la sesión Auth de Supabase
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        currentId = user.id;
        currentEmail = user.email;
      } else {
        // 2. Fallback a localStorage si el login fue por almacenamiento local
        const sessionData = JSON.parse(localStorage.getItem('user_data') || '{}');
        currentId = sessionData.id || sessionData.user_id || null;
        currentEmail = sessionData.email || sessionData.correo || '';
      }

      if (currentId) {
        setUserId(currentId);
        setCorreoActual(currentEmail);
        setCorreo(currentEmail);

        const { data: perfil, error: perfilErr } = await supabase
          .from('perfiles')
          .select('nombre, apellido, telefono, fecha_nacimiento')
          .eq('id', currentId)
          .maybeSingle();
          
        if (perfil) {
          setNombre(perfil.nombre || '');
          setApellido(perfil.apellido || '');
          setTelefono(perfil.telefono || '');
          setFechaNacimiento(perfil.fecha_nacimiento || '');
        }
      }
    } catch (error) {
      console.error("Error al obtener datos del usuario:", error);
    } finally {
      setCargando(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setMensaje({ tipo: '', texto: '' });

    try {
      // Determinar ID activo al momento de guardar
      let activeUserId = userId;
      if (!activeUserId) {
        const sessionData = JSON.parse(localStorage.getItem('user_data') || '{}');
        activeUserId = sessionData.id || sessionData.user_id;
      }

      if (!activeUserId) {
        throw new Error("No se pudo verificar tu sesión. Por favor inicia sesión nuevamente.");
      }

      // Actualizar credenciales de Supabase Auth sólo si se especificó una nueva contraseña
      if (nuevaPassword.trim() !== '') {
        if (passwordActual.trim() === '') {
          throw new Error("Debes ingresar tu contraseña actual para poder cambiarla.");
        }
        if (passwordActual === nuevaPassword) {
          throw new Error("La nueva contraseña no puede ser igual a la actual.");
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: correoActual,
          password: passwordActual
        });

        if (signInError) throw new Error("La contraseña actual es incorrecta.");

        const { error: updateError } = await supabase.auth.updateUser({
          password: nuevaPassword
        });

        if (updateError) throw new Error("Error al actualizar la contraseña: " + updateError.message);
      }

      // Actualizar email si cambió
      if (correo && correo !== correoActual) {
        const { error: emailError } = await supabase.auth.updateUser({ email: correo });
        if (emailError) throw new Error("Error al actualizar correo: " + emailError.message);
      }

      // Upsert directo en la tabla 'perfiles' de Supabase
      const { error: perfilError } = await supabase
        .from('perfiles')
        .upsert({
          id: activeUserId,
          nombre: nombre,
          apellido: apellido,
          telefono: telefono,
          fecha_nacimiento: fechaNacimiento === '' ? null : fechaNacimiento
        });

      if (perfilError) throw new Error("Error al guardar perfil: " + perfilError.message);

      setMensaje({ tipo: 'exito', texto: '¡Tus datos se actualizaron correctamente!' });
      setPasswordActual(''); 
      setNuevaPassword(''); 
      setCorreoActual(correo);

    } catch (error) {
      console.error("Error en la actualización:", error);
      setMensaje({ tipo: 'error', texto: error.message || "No se pudieron guardar los cambios." });
    } finally {
      setGuardando(false);
      setTimeout(() => setMensaje({ tipo: '', texto: '' }), 5000);
    }
  };

  if (cargando) return <div className="flex justify-center p-10 text-gray-500 animate-pulse">Cargando tu información...</div>;

  return (
    <div className="py-8 bg-gray-50 min-h-screen font-sans animate-fade-in">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-100">
            <h2 className="text-2xl font-black text-gray-900">Configuración de Cuenta</h2>
            <p className="text-sm text-gray-500 font-medium mt-1">Gestiona tus datos personales y credenciales de acceso.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
            <div>
              <h3 className="text-lg font-bold text-autoblue border-b border-gray-100 pb-2 mb-4">Datos Personales</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nombre</label>
                  <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="Tu nombre" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Apellidos</label>
                  <input type="text" value={apellido} onChange={(e) => setApellido(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="Tus apellidos" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Fecha de Nacimiento</label>
                  <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Teléfono</label>
                  <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="+52..." />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-autoblue border-b border-gray-100 pb-2 mb-4">Seguridad de la Cuenta</h3>
              
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-1">Correo Electrónico</label>
                <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className="w-full max-w-md px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña Actual</label>
                  <input 
                    type="password" 
                    value={passwordActual} 
                    onChange={(e) => setPasswordActual(e.target.value)} 
                    className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white" 
                    placeholder="Requerida para cambiar contraseña" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nueva Contraseña</label>
                  <input 
                    type="password" 
                    value={nuevaPassword} 
                    onChange={(e) => setNuevaPassword(e.target.value)} 
                    className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white" 
                    placeholder="Mínimo 6 caracteres" 
                  />
                </div>
              </div>
            </div>

            {mensaje.texto && (
              <div className={`p-4 rounded-xl text-sm font-bold ${mensaje.tipo === 'exito' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {mensaje.texto}
              </div>
            )}

            <div className="pt-4 flex justify-end border-t border-gray-100">
              <button type="submit" disabled={guardando} className="bg-gray-900 hover:bg-gray-800 text-white font-bold py-2.5 px-6 rounded-xl text-sm disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}