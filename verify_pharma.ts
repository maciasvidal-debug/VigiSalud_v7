
import { parsePresentation } from './src/utils/PharmaParser';

// Test Cases
const cases = [
    {
        name: "HERCEPTIN 440 MG",
        form: "POLVO LIOFILIZADO PARA SOLUCIÓN PARA INFUSIÓN",
        desc: "CAJA POR 1 VIAL MULTIDOSIS CON 440 MG DE POLVO LIOFILIZADO",
        expected: {
            mode: 'DISCRETE',
            containerType: 'VIAL'
        }
    },
    {
        name: "POLVO SIMPLE (SOBRE)",
        form: "POLVO",
        desc: "CAJA X 30 SOBRES DE 5 G",
        expected: {
            mode: 'MASS_BASED',
            containerType: 'SOBRE'
        }
    },
    {
        name: "POLVO SIMPLE (FRASCO)",
        form: "POLVO PARA SUSPENSION",
        desc: "FRASCO X 100 ML",
        expected: {
            mode: 'DISCRETE', // Should be Discrete (Frasco) or Volumetric (if prepared)?
            // According to task: "Si el envase es 'FRASCO' (ej: Suspensión oral para preparar) -> mode: 'DISCRETE', type: 'FRASCO'."
            // Actually, if it is "POLVO PARA SUSPENSION" it is often counted as units (Frascos).
            containerType: 'FRASCO'
        }
    },
    {
        name: "TABLETAS",
        form: "TABLETAS",
        desc: "CAJA X 100 TABLETAS",
        expected: {
            mode: 'DISCRETE',
            containerType: 'TABLETA'
        }
    },
    {
        name: "JARABE",
        form: "JARABE",
        desc: "FRASCO X 120 ML",
        expected: {
            mode: 'VOLUMETRIC',
            containerType: 'FRASCO'
        }
    },
    {
        name: "CREMA",
        form: "CREMA",
        desc: "TUBO X 20 G",
        expected: {
            mode: 'MASS_BASED',
            containerType: 'TUBO'
        }
    }
];

console.log("--- RUNNING PHARMA PARSER TESTS ---");

let passed = 0;
let failed = 0;

cases.forEach(c => {
    const result = parsePresentation(c.form, c.desc);
    const modeMatch = result.mode === c.expected.mode;
    const typeMatch = result.containerType === c.expected.containerType;

    if (modeMatch && typeMatch) {
        console.log(`[PASS] ${c.name}: ${result.mode} - ${result.containerType}`);
        passed++;
    } else {
        console.log(`[FAIL] ${c.name}`);
        console.log(`  Expected: ${c.expected.mode} - ${c.expected.containerType}`);
        console.log(`  Actual:   ${result.mode} - ${result.containerType}`);
        failed++;
    }

    // Check specific unit requirement for Discrete
    if (result.mode === 'DISCRETE' && result.contentNet > 0) {
        // Task says: "Si detecta unidades de masa (mg, g, UI) en un modo discreto (Vial/Tableta), NO intentes calcular volumen."
        // We verify that contentUnit is NOT volume if it was parsed as mass
        // Actually, parsePresentation currently extracts contentNet/Unit.
        // We need to ensure that logic downstream (SeizureCalculator) or inside Parser handles this "Total Volume" suppression.
        // The parser SHOULD return content info (e.g. 440 mg), but the APPLICATION should not calculate volume.
        console.log(`  Content: ${result.contentNet} ${result.contentUnit}`);
    }
});

console.log(`\nResult: ${passed}/${cases.length} passed.`);
