import { db } from '../db';
import type { Establishment, CategoryType } from '../types';

// DATOS MAESTROS (Coherentes con CensusForm)
const CITIES = [
  { name: "BARRANQUILLA", dane: "08001", lat: 10.9685, lng: -74.7813 },
  { name: "SOLEDAD", dane: "08758", lat: 10.9184, lng: -74.7646 },
  { name: "MALAMBO", dane: "08433", lat: 10.8583, lng: -74.7739 },
  { name: "SABANALARGA", dane: "08638", lat: 10.6333, lng: -74.9167 },
  { name: "GALAPA", dane: "08296", lat: 10.9184, lng: -74.8333 },
];

const SUBTYPES = {
  FORMAL: ["DROGUERÍA", "FARMACIA-DROGUERÍA", "DEPÓSITO DE DROGAS", "TIENDA NATURISTA"],
  INFORMAL: ["TIENDA DE BARRIO", "MISCELÁNEA", "RESTAURANTE", "PANADERÍA"],
  AMBULANTE: ["PUESTO DE ALIMENTOS", "VENTA DE ACCESORIOS", "FRUTAS/VERDURAS"]
};

// GENERADORES ALEATORIOS REALISTAS
const NAMES = ["SAN ROQUE", "LA REBAJA", "ALEMANA", "INGLESA", "LA ECONOMIA", "VIDA", "SALUD", "BIENESTAR", "EL SOL", "LA LUNA", "CENTRAL", "NORTE", "SUR", "DEL PARQUE", "LA 14", "EL AHORRO", "EXPRESS", "PHARMA", "VITAL", "INTEGRAL"];
const LAST_NAMES = ["PEREZ", "RODRIGUEZ", "GOMEZ", "LOPEZ", "MARTINEZ", "GARCIA", "HERNANDEZ", "GONZALEZ", "RAMIREZ", "TORRES", "FLORES", "RIVERA", "DIAZ", "REYES", "MORALES"];
const FIRST_NAMES = ["JUAN", "MARIA", "CARLOS", "ANA", "LUIS", "LAURA", "JOSE", "MARTA", "JORGE", "ELENA", "ANDRES", "SOFIA", "DAVID", "ISABEL", "MIGUEL"];

// Helpers
const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const generateNit = () => `900.${Math.floor(Math.random() * 899 + 100)}.${Math.floor(Math.random() * 899 + 100)}-${Math.floor(Math.random() * 9)}`;
const generateCC = () => `1.140.${Math.floor(Math.random() * 899 + 100)}.${Math.floor(Math.random() * 899 + 100)}`;
const generatePhone = () => `300${Math.floor(Math.random() * 8999999 + 1000000)}`;
const jitter = (coord: number) => coord + (Math.random() - 0.5) * 0.02;

export const seedDatabase = async () => {
  const establishments: Establishment[] = [];

  for (let i = 0; i < 100; i++) {
    // 1. Definir Categoría (60% Formal, 20% Informal, 20% Ambulante)
    const randCat = Math.random();
    let category: CategoryType = "FORMAL";
    if (randCat > 0.6) category = "INFORMAL";
    if (randCat > 0.8) category = "AMBULANTE";

    // 2. Definir Datos Básicos
    const cityData = getRandomItem(CITIES);
    const subtype = getRandomItem(SUBTYPES[category] as string[]); 
    const commercialName = getRandomItem(NAMES);
    
    const fullName = `${subtype} ${commercialName} ${i + 1}`; 

    // 3. Generar Responsable (SIEMPRE PERSONA NATURAL PARA PRUEBAS CORRECTAS)
    const respName = getRandomItem(FIRST_NAMES);
    const respLast = getRandomItem(LAST_NAMES);
    const responsibleName = `${respName} ${respLast}`;

    // 4. Datos Específicos por Categoría
    let address = "";
    let techDirectorName = undefined;
    let techDirectorId = undefined;
    let techDirectorTp = undefined;
    let mobileUnitType = undefined;

    if (category === "AMBULANTE") {
      address = `SECTOR: PARQUE ${cityData.name} - PUESTO ${i}`;
      mobileUnitType = getRandomItem(["CARRITO", "ESTACIONARIO", "BANDEJA"]);
    } else {
      address = `CARRERA ${Math.floor(Math.random() * 90 + 1)} # ${Math.floor(Math.random() * 90 + 1)}-${Math.floor(Math.random() * 90 + 1)}`;
    }

    if (category === "FORMAL" && (subtype === "DROGUERÍA" || subtype === "FARMACIA-DROGUERÍA")) {
      const tdName = getRandomItem(FIRST_NAMES);
      const tdLast = getRandomItem(LAST_NAMES);
      techDirectorName = `${tdName} ${tdLast}`;
      techDirectorId = generateCC();
      techDirectorTp = `TP-${Math.floor(Math.random() * 50000)}`;
    }

    // 5. Construcción del Objeto
    const establishment: Establishment = {
      category,
      idType: category === 'FORMAL' ? 'NIT' : 'CC',
      nit: category === 'FORMAL' ? generateNit() : generateCC(),
      name: fullName,
      commercialName: commercialName,
      type: subtype,
      city: cityData.name,
      daneCode: cityData.dane,
      lat: jitter(cityData.lat),
      lng: jitter(cityData.lng),
      address: address,
      sector: category === "AMBULANTE" ? "CENTRO" : undefined,
      phone: generatePhone(),
      emailJudicial: `contacto@${commercialName.toLowerCase().replace(/\s/g, '')}${i}.com`,
      
      // BLINDAJE: Responsable Persona Natural
      responsibleName: responsibleName,
      responsibleId: generateCC(),

      // Datos Técnicos
      techDirectorName,
      techDirectorId,
      techDirectorTp,
      
      mobileUnitType,

      status: 'ACTIVO'
    };

    establishments.push(establishment);
  }

  // Inserción Masiva
  await db.establishments.bulkAdd(establishments);
  return true;
};