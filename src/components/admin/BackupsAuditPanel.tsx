import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiRequest } from '../../services/api';
import { useFeedback } from '../../context/FeedbackContext';

interface BackupItem {
  name: string;
  size: number;
  createdAt: string;
}

interface AuditItem {
  id: number;
  action: string;
  entity: string;
  entityId: string | null;
  detail: string;
  userRole: string | null;
  createdAt: string;
}

export function BackupsAuditPanel() {
  const { showToast } = useFeedback();
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [backupList, auditList] = await Promise.all([
        apiRequest<BackupItem[]>('/admin/backups'),
        apiRequest<any[]>('/admin/audit?limit=100'),
      ]);
      setBackups(backupList);
      setAudits(auditList.map((item) => ({
        id: item.id,
        action: item.action,
        entity: item.entity,
        entityId: item.entity_id,
        detail: item.detail,
        userRole: item.user_role,
        createdAt: item.created_at,
      })));
    } catch (error: any) {
      showToast(error.message || 'No se pudo cargar auditoría y respaldos.', true);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createBackup = async () => {
    try {
      await apiRequest<{ success: boolean }>('/admin/backups', { method: 'POST' });
      showToast('Respaldo de base de datos creado correctamente.', false, 'success');
      loadData();
    } catch (error: any) {
      showToast(error.message || 'No se pudo crear el respaldo.', true);
    }
  };

  const downloadBackup = async (name: string) => {
    try {
      const response = await apiFetch(`/admin/backups/${encodeURIComponent(name)}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error: any) {
      showToast(error.message || 'No se pudo descargar el respaldo.', true);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <section className="card-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Respaldos de base de datos</h3>
          <button type="button" className="btn btn-primary" onClick={createBackup} disabled={loading}>
            Crear respaldo ahora
          </button>
        </div>
        {loading ? <p>Cargando respaldos...</p> : backups.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Aún no hay respaldos disponibles.</p>
        ) : (
          <div className="table-responsive-container phone-card-list">
            <table className="phone-card-table w-full text-xs">
              <thead><tr><th>Archivo</th><th>Fecha</th><th>Tamaño</th><th></th></tr></thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.name}>
                    <td data-label="Archivo">{backup.name}</td>
                    <td data-label="Fecha">{new Date(backup.createdAt).toLocaleString()}</td>
                    <td data-label="Tamaño">{(backup.size / 1024).toFixed(1)} KB</td>
                    <td data-label="Acciones"><button type="button" className="btn btn-light" onClick={() => downloadBackup(backup.name)}>Descargar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card-box">
        <h3 style={{ marginTop: 0 }}>Auditoría de operaciones</h3>
        {loading ? <p>Cargando auditoría...</p> : audits.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Sin eventos registrados.</p>
        ) : (
          <div className="table-responsive-container phone-card-list" style={{ maxHeight: '380px', overflow: 'auto' }}>
            <table className="phone-card-table w-full text-xs">
              <thead><tr><th>Fecha</th><th>Acción</th><th>Detalle</th><th>Rol</th></tr></thead>
              <tbody>
                {audits.map((audit) => (
                  <tr key={audit.id}>
                    <td data-label="Fecha">{audit.createdAt}</td>
                    <td data-label="Acción">{audit.action}</td>
                    <td data-label="Detalle">{audit.detail}</td>
                    <td data-label="Rol">{audit.userRole || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
