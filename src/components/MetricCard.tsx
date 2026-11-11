// ============================================================
// MetricCard.tsx
// Tarjeta de métrica financiera reutilizable.
//
// Muestra un KPI con:
//   • Etiqueta descriptiva (label)
//   • Valor numérico formateado (con prefijo "$" si es número)
//   • Ícono SVG temático según iconType
//   • Color de acento derivado del tono (success/danger/warning/primary)
//   • Subtítulo opcional para información adicional
//   • Variante visual de "ganancia" (fondo verde oscuro, texto blanco)
//
// Props:
//   label       — Texto descriptivo de la métrica (ej. "Ventas del Día").
//   value       — Número o string a mostrar. Los números se formatean como $X.XX.
//   tone        — Color semántico: 'success' | 'danger' | 'warning' | 'primary'.
//   iconType    — Tipo de ícono SVG: 'cash' (default) | 'up' | 'down' | 'pct' | 'box' | 'pause' | 'check'.
//   subtitle    — Texto secundario pequeño debajo del valor.
//   isProfitCard— Si es true aplica el estilo de tarjeta de ganancia neta.
//
// Clases CSS: definidas en css/dashboard.css
//   .metric-card, .metric-card-profit, .label, .value, .m-icon, [data-tone]
// ============================================================
import React from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  tone: 'success' | 'danger' | 'warning' | 'primary';
  iconType?: 'up' | 'down' | 'pct' | 'cash' | 'wallet' | 'check' | 'pause' | 'box';
  subtitle?: string;
  isProfitCard?: boolean;
}

export function MetricCard({
  label,
  value,
  tone,
  iconType = 'cash',
  subtitle,
  isProfitCard = false,
}: MetricCardProps) {
  // Formatear como moneda si el valor es numérico
  const formattedValue = typeof value === 'number' ? `$${value.toFixed(2)}` : value;

  // Mapa de colores de acento usando variables CSS del tema (modo claro)
  const toneColorMap: Record<typeof tone, string> = {
    success: 'var(--success)',   // Verde salvia
    danger:  'var(--danger)',    // Terracota
    warning: 'var(--warning)',   // Ocre dorado
    primary: 'var(--primary)',   // Verde principal
  };

  const borderColor = toneColorMap[tone];

  // ── Iconos SVG por tipo ──────────────────────────────────
  // Todos usan stroke sin fill, strokeWidth=1.6, 24×24 viewBox.
  const renderIcon = () => {
    switch (iconType) {
      case 'up':
        // Flecha hacia arriba con tendencia positiva
        return <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />;

      case 'down':
        // Flecha hacia abajo con tendencia negativa
        return <path d="M3 7l6 6 4-4 8 8M15 17h6v-6" />;

      case 'pct':
        // Símbolo de porcentaje (IVA)
        return (
          <>
            <path d="M19 5L5 19" />
            <circle cx="7" cy="7" r="2.5" />
            <circle cx="17" cy="17" r="2.5" />
          </>
        );

      case 'box':
        // Caja de producto (inventario)
        return (
          <>
            <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
            <path d="M3 8l9 5 9-5M12 13v8" />
          </>
        );

      case 'pause':
        // Círculo con líneas de pausa (apartados en espera)
        return (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M10 9v6M14 9v6" />
          </>
        );

      case 'check':
        // Círculo con palomita (confirmado / completado)
        return (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.7 2.7L16 9.5" />
          </>
        );

      case 'cash':
      default:
        // Billete / efectivo (ventas y montos)
        return (
          <>
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2.5" />
            <path d="M6 12h.01M18 12h.01" />
          </>
        );
    }
  };

  return (
    <div
      className={`metric-card ${isProfitCard ? 'metric-card-profit' : ''}`}
      style={{ borderTop: `2px solid ${borderColor}` }}
      data-tone={tone}
      role="group"
      aria-label={`${label}: ${formattedValue}`}
    >
      {/* Ícono temático con fondo de tono */}
      <div className="m-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {renderIcon()}
        </svg>
      </div>

      <div>
        {/* Etiqueta descriptiva de la métrica */}
        <div className="label">{label}</div>

        {/* Valor principal con color de acento del tono */}
        <div className="value" style={{ color: isProfitCard ? '#FFFFFF' : borderColor }}>
          {formattedValue}
        </div>

        {/* Subtítulo opcional (información adicional, desglose, etc.) */}
        {subtitle && (
          <div
            style={{
              fontSize: '0.72rem',
              color: isProfitCard ? '#D1FAE5' : 'var(--text-muted)',
              marginTop: '4px',
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
