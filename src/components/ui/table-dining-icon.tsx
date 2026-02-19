/**
 * Icono minimalista de mesa de restaurante (vista superior / plano de planta)
 * Mesa redonda con 4 sillas alrededor - estilo blueprint
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
        r="5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.08"
      />
      {/* Silla arriba */}
      <rect x="9.5" y="1" width="5" height="3" rx="1.5" fill="currentColor" opacity="0.5" />
      {/* Silla abajo */}
      <rect x="9.5" y="20" width="5" height="3" rx="1.5" fill="currentColor" opacity="0.5" />
      {/* Silla izquierda */}
      <rect x="1" y="9.5" width="3" height="5" rx="1.5" fill="currentColor" opacity="0.5" />
      {/* Silla derecha */}
      <rect x="20" y="9.5" width="3" height="5" rx="1.5" fill="currentColor" opacity="0.5" />
    </svg>
  )
}
