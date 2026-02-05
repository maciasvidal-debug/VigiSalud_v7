// Fórmula de Haversine para calcular distancia ortodrómica
// WGS84 para integridad de pruebas técnicas
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Radio de la tierra en metros
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Retorno entero en metros
};

// Generador de Radicados Atlántico (Algoritmo de Integridad)
export const generateActId = (cityCode: string = "08001") => {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000); 
  return `IVC-${cityCode}-${year}-${random}`;
};