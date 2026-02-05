/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // PALETA SEMÁNTICA (Design Tokens)
      // Usa estos nombres en lugar de colores sueltos
      colors: {
        brand: {
          DEFAULT: '#0d9488', // Teal-600 (Color Principal Gobernación)
          light: '#ccfbf1',   // Teal-100 (Fondos suaves)
          dark: '#0f766e',    // Teal-700 (Hover)
          deep: '#115e59',    // Teal-800 (Textos oscuros de marca)
        },
        surface: {
          ground: '#f8fafc',  // Slate-50 (Fondo de la App - Gris clínico)
          card: '#ffffff',    // Blanco puro (Tarjetas)
          hover: '#f1f5f9',   // Slate-100 (Hover en filas/items)
          border: '#e2e8f0',  // Slate-200 (Bordes sutiles)
        },
        content: {
          primary: '#0f172a',   // Slate-900 (Títulos, Textos fuertes)
          secondary: '#64748b', // Slate-500 (Subtítulos, Metadatos)
          tertiary: '#94a3b8',  // Slate-400 (Iconos inactivos, Placeholders)
        },
        status: {
          success: '#10b981', // Emerald-500
          successBg: '#ecfdf5',
          error: '#ef4444',   // Red-500
          errorBg: '#fef2f2',
          warning: '#f59e0b', // Amber-500
          warningBg: '#fffbeb',
          info: '#3b82f6',    // Blue-500
          infoBg: '#eff6ff',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'glow': '0 0 15px rgba(13, 148, 136, 0.3)', // Resplandor Teal
      }
    },
  },
  plugins: [],
}