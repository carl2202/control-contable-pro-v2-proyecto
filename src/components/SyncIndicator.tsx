// ============================================================
// SyncIndicator.tsx
// Indicador de conectividad con el servidor.
//
// - Hace ping a GET /api/health cada 30 segundos.
// - Estados: 'online' | 'offline' | 'syncing'
// - Dot de ~8px + texto corto, se ubica en el Header.
// ============================================================
import React, { useState, useEffect, useRef } from 'react';

type SyncState = 'online' | 'offline' | 'syncing';

const PING_INTERVAL_MS = 30_000;

export default function SyncIndicator() {
  const [status, setStatus] = useState<SyncState>('syncing');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    let requestController: AbortController | null = null;

    const ping = async () => {
      requestController = new AbortController();
      const requestTimeout = window.setTimeout(() => requestController?.abort(), 10_000);
      setStatus('syncing');
      try {
        const response = await fetch('/api/health', {
          method: 'GET',
          cache: 'no-store',
          signal: requestController.signal,
        });
        if (active) setStatus(response.ok ? 'online' : 'offline');
      } catch {
        if (active) setStatus('offline');
      } finally {
        window.clearTimeout(requestTimeout);
        requestController = null;
        if (active) timeoutRef.current = setTimeout(ping, PING_INTERVAL_MS);
      }
    };

    void ping();
    return () => {
      active = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      requestController?.abort();
    };
  }, []);

  const label: Record<SyncState, string> = {
    online: 'En línea',
    offline: 'Sin conexión',
    syncing: 'Sincronizando...',
  };

  const dotColor: Record<SyncState, string> = {
    online: '#6aad70',
    offline: '#e07a5a',
    syncing: '#d4a44c',
  };

  const isPulsing = status === 'syncing';

  return (
    <div
      title={label[status]}
      aria-label={`Estado del sistema: ${label[status]}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
        borderRadius: 'var(--radius-full)',
        background: 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(255,255,255,0.18)',
        fontSize: '0.7rem',
        color: 'rgba(255,255,255,0.85)',
        fontFamily: 'var(--font-sans)',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: dotColor[status],
          flexShrink: 0,
          animation: isPulsing ? 'sync-pulse 1s ease-in-out infinite' : undefined,
        }}
      />
      <style>{`
        @keyframes sync-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      <span>{label[status]}</span>
    </div>
  );
}
