import React from 'react';
import * as LucideIcons from 'lucide-react';
// CORRECCIÓN AQUÍ: Agregamos 'type' para que Vite no lo busque en tiempo de ejecución
import type { LucideProps } from 'lucide-react';

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: string;
}

export const Icon: React.FC<IconProps> = ({ name, className, size = 18, ...props }) => {
  // Convertir kebab-case a PascalCase para buscar en el objeto de iconos
  // ej: "arrow-right" -> "ArrowRight"
  const pascalName = name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  // Acceder dinámicamente al icono desde el namespace importado
  const LucideIcon = (LucideIcons as any)[pascalName];

  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found in lucide-react`);
    // Fallback invisible para no romper el layout
    return <span style={{ width: size, height: size, display: 'inline-block' }} />;
  }

  return <LucideIcon size={size} className={className} {...props} />;
};