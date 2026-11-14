import { useEffect, useRef } from 'react';

/**
 * Detecta lectores de código de barras / QR que funcionan como teclado (USB o Bluetooth HID).
 * El lector "teclea" el código muy rápido y termina con Enter; una persona nunca teclea tan rápido.
 *
 * @param {(codigo: string) => void} onScan  Se llama con el código escaneado.
 * @param {object}  opciones
 * @param {boolean} opciones.enabled     Activa/desactiva la escucha (default: true).
 * @param {number}  opciones.minLength   Largo mínimo para considerar que es un escaneo (default: 4).
 * @param {number}  opciones.maxGapMs    Tiempo máximo entre teclas de un escaneo (default: 50 ms).
 *
 * Reglas con inputs:
 *  - Si el foco está en un input/textarea/select, el escaneo SOLO dispara onScan si el campo
 *    tiene el atributo data-scanner="true". En cualquier otro campo el código se escribe ahí
 *    normalmente, pero se bloquea el Enter final para que no envíe el formulario por accidente.
 */
export default function useScanner(onScan, { enabled = true, minLength = 4, maxGapMs = 50 } = {}) {
  const buffer = useRef('');
  const ultimaTecla = useRef(0);
  const callbackRef = useRef(onScan);

  // Siempre usamos la versión más reciente del callback sin re-suscribir el listener
  useEffect(() => {
    callbackRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e) => {
      const ahora = Date.now();
      if (ahora - ultimaTecla.current > maxGapMs) buffer.current = '';
      ultimaTecla.current = ahora;

      if (e.key === 'Enter') {
        const codigo = buffer.current;
        buffer.current = '';
        if (codigo.length < minLength) return; // Enter normal de una persona

        // Fue un escaneo: evitamos que el Enter active botones o envíe formularios
        e.preventDefault();
        e.stopPropagation();

        const el = e.target;
        const esCampo = el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
        if (esCampo && el.dataset?.scanner !== 'true') return;

        callbackRef.current(codigo);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer.current += e.key;
      }
    };

    // capture = true para ejecutarse antes que cualquier otro manejador de teclado
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [enabled, minLength, maxGapMs]);
}
