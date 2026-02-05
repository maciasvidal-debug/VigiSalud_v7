// src/utils/security.ts

/**
 * Genera un Hash seguro SHA-256 con Salt aleatoria.
 * Formato de salida: "salt:hash"
 */
export const hashPin = async (pin: string): Promise<string> => {
  // 1. Generar Salt aleatoria (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // 2. Combinar Salt + PIN
  const encoder = new TextEncoder();
  const data = encoder.encode(saltHex + pin);
  
  // 3. Hashear
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
};

/**
 * Verifica si el PIN ingresado coincide con el Hash almacenado.
 * Soporta migración automática:
 * - Si storedPin no tiene ':', asume que es viejo (texto plano) y compara directo.
 * - Si tiene ':', extrae la salt y recacula el hash.
 */
export const verifyPin = async (inputPin: string, storedPin: string): Promise<boolean> => {
  if (!storedPin) return false;

  // COMPATIBILIDAD HACIA ATRÁS:
  // Si no tiene el separador ':', es un PIN viejo sin encriptar.
  if (!storedPin.includes(':')) {
    return inputPin === storedPin; 
  }

  const [saltHex, originalHash] = storedPin.split(':');
  
  // Recrear el hash con la salt guardada + el pin ingresado
  const encoder = new TextEncoder();
  const data = encoder.encode(saltHex + inputPin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const newHashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return newHashHex === originalHash;
};