/**
 * Icono minimalista de mesa de restaurante (vista superior / plano de planta)
 * Mesa redonda con 4 sillas alrededor - estilo blueprint azul
 */
export function TableDiningIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Mesa central */}
      <circle
        cx="12"
        cy="12"
        r="4.5"
        fill="currentColor"
        opacity="0.2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Silla arriba */}
      <rect x="9" y="1.5" width="6" height="2.5" rx="1.25" fill="currentColor" />
      {/* Silla abajo */}
      <rect x="9" y="20" width="6" height="2.5" rx="1.25" fill="currentColor" />
      {/* Silla izquierda */}
      <rect x="1.5" y="9" width="2.5" height="6" rx="1.25" fill="currentColor" />
      {/* Silla derecha */}
      <rect x="20" y="9" width="2.5" height="6" rx="1.25" fill="currentColor" />
    </svg>
  )
}
