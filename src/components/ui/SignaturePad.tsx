import React, { useRef, useState, useEffect } from 'react';

interface SignaturePadProps {
  onChange: (signatureData: string | null) => void;
  label?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onChange, label = "Firma del Funcionario / Responsable" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  // Helper para obtener el contexto 2D de forma segura
  const getContext = () => canvasRef.current?.getContext('2d');

  // Configuración inicial del Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Ajustar ancho al contenedor padre
      canvas.width = canvas.parentElement?.clientWidth || 500;
      canvas.height = 200; 
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 2;
        ctx.lineCap = 'round'; // Borde redondeado para que la firma se vea suave
        ctx.strokeStyle = '#000000'; // Color negro
      }
    }
  }, []);

  // --- LÓGICA DE DIBUJO (Soporte Híbrido Mouse/Touch) ---

  const getCoordinates = (event: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = (event as React.MouseEvent).clientX;
      clientY = (event as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    // Solo prevenimos default si es touch para evitar scroll, permitimos mouse events normales
    if ('touches' in e) e.preventDefault(); 
    
    setIsDrawing(true);
    const ctx = getContext();
    const { x, y } = getCoordinates(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    if ('touches' in e) e.preventDefault();
    
    const ctx = getContext();
    const { x, y } = getCoordinates(e);
    ctx?.lineTo(x, y);
    ctx?.stroke();
    if (isEmpty) setIsEmpty(false);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveSignature();
    }
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (canvas && !isEmpty) {
      // Exportamos la imagen como Base64 (PNG)
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setIsEmpty(true);
      onChange(null); // Notificamos al padre que se borró la firma
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      
      {/* Contenedor con borde y touch-none para evitar scroll al firmar */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white touch-none">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-[200px] cursor-crosshair block rounded-lg"
        />
      </div>

      <div className="mt-2 flex justify-between items-center text-xs text-gray-500">
        <span>* Firme dentro del recuadro usando mouse o dedo.</span>
        <button
          type="button"
          onClick={clearCanvas}
          className="text-red-600 hover:text-red-800 font-medium px-3 py-1 border border-transparent hover:border-red-200 rounded transition-colors"
        >
          Borrar Firma
        </button>
      </div>
    </div>
  );
};