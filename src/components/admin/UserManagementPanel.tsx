// ============================================================
// UserManagementPanel.tsx
// Panel de Gestión de Usuarios y Contraseñas para el Administrador
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { UsersService, SystemUser } from '../../services/users.service';
import { useFeedback } from '../../context/FeedbackContext';
import { apiRequest } from '../../services/api';

export function UserManagementPanel() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { showToast, confirm } = useFeedback();

  // Modal / Form estado para restablecer contraseña
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isSubmittingPass, setIsSubmittingPass] = useState<boolean>(false);

  // Modal / Form estado para nuevo empleado
  const [showNewUserModal, setShowNewUserModal] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newUserPass, setNewUserPass] = useState<string>('');
  const [newUserDisplayName, setNewUserDisplayName] = useState<string>('');
  const [newUserPin, setNewUserPin] = useState<string>('');
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await UsersService.getUsers();
      setUsers(data);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar usuarios del sistema', true);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleOpenReset = (user: SystemUser) => {
    setSelectedUser(user);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleCloseReset = () => {
    setSelectedUser(null);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!/^\d{4,6}$/.test(newPassword)) {
      showToast('El PIN debe contener entre 4 y 6 dígitos.', true);
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('Las contraseñas no coinciden.', true);
      return;
    }

    try {
      setIsSubmittingPass(true);
      await UsersService.resetPassword(selectedUser.id, newPassword);
      showToast(`PIN de ${selectedUser.displayName} actualizado con éxito.`, false, 'success');
      handleCloseReset();
      loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Error al restablecer contraseña.', true);
    } finally {
      setIsSubmittingPass(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newUsername.trim().length < 4) {
      showToast('El usuario debe tener al menos 4 caracteres.', true);
      return;
    }

    if (newUserPass.trim().length < 4) {
      showToast('La contraseña debe tener al menos 4 caracteres.', true);
      return;
    }
    if (!/^\d{4,6}$/.test(newUserPin)) {
      showToast('El PIN debe contener entre 4 y 6 dígitos.', true);
      return;
    }

    try {
      setIsCreatingUser(true);
      await apiRequest('/auth/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newUserPass.trim(),
          displayName: newUserDisplayName.trim() || `${newUsername.trim()} (Cajero)`,
          pin: newUserPin,
        }),
      });

      showToast('Nuevo usuario/cajero creado correctamente.', false, 'success');
      setShowNewUserModal(false);
      setNewUsername('');
      setNewUserPass('');
      setNewUserDisplayName('');
      setNewUserPin('');
      loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Error al crear el usuario.', true);
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <div className="card" style={{ padding: '24px', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Usuarios y Cajeros del Sistema
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Administración segura de credenciales y permisos del personal.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewUserModal(true)}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '44px', padding: '0 16px' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          + Nuevo Cajero
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Cargando usuarios...
        </div>
      ) : (
        <div className="table-responsive">
          <table className="terminal-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Usuario</th>
                <th style={{ textAlign: 'left' }}>Nombre Visible</th>
                <th style={{ textAlign: 'left' }}>Rol</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                    @{u.username}
                  </td>
                  <td>{u.displayName}</td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: u.role === 'dueno' ? 'rgba(79, 111, 82, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                        color: u.role === 'dueno' ? 'var(--primary)' : 'var(--text-muted)',
                      }}
                    >
                      {u.role === 'dueno' ? 'Dueño / Admin' : 'Cajero / Empleado'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: u.active !== false ? 'var(--success)' : 'var(--text-subtle)',
                        marginRight: '6px',
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-body)' }}>
                      {u.active !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenReset(u)}
                      className="btn btn-outline"
                      style={{
                        fontSize: '0.78rem',
                        padding: '6px 12px',
                        minHeight: '36px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      title="Cambiar contraseña de este usuario"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      Cambiar Clave
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal para restablecer contraseña */}
      {selectedUser && (
        <div className="dlg-overlay" role="dialog" aria-modal="true" style={{ zIndex: 10000 }}>
          <div className="dlg" style={{ maxWidth: '420px', width: '100%', background: 'var(--surface)' }}>
            <div className="dlg-head">
              <h3 className="dlg-title" style={{ fontSize: '1rem', color: 'var(--text-main)', margin: 0 }}>
                Restablecer PIN: {selectedUser.displayName}
              </h3>
              <button
                type="button"
                onClick={handleCloseReset}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReset} className="dlg-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
                  Nuevo PIN (4 a 6 dígitos)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ingrese el nuevo PIN"
                  required
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px', padding: '0 12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
                  Confirmar PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, ''))}
                  placeholder="Repita el nuevo PIN"
                  required
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px', padding: '0 12px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={handleCloseReset}
                  className="btn btn-outline"
                  style={{ minHeight: '44px', padding: '0 16px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPass}
                  className="btn btn-primary"
                  style={{ minHeight: '44px', padding: '0 16px' }}
                >
                  {isSubmittingPass ? 'Guardando...' : 'Actualizar PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Crear Nuevo Cajero */}
      {showNewUserModal && (
        <div className="dlg-overlay" role="dialog" aria-modal="true" style={{ zIndex: 10000 }}>
          <div className="dlg" style={{ maxWidth: '440px', width: '100%', background: 'var(--surface)' }}>
            <div className="dlg-head">
              <h3 className="dlg-title" style={{ fontSize: '1rem', color: 'var(--text-main)', margin: 0 }}>
                Registrar Nuevo Cajero / Empleado
              </h3>
              <button
                type="button"
                onClick={() => setShowNewUserModal(false)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="dlg-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
                  Nombre de Usuario (Login)
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="ej. cajero2"
                  required
                  minLength={4}
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px', padding: '0 12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
                  Nombre Visible / Nombre del Personal
                </label>
                <input
                  type="text"
                  value={newUserDisplayName}
                  onChange={(e) => setNewUserDisplayName(e.target.value)}
                  placeholder="ej. Carlos Benítez"
                  required
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px', padding: '0 12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
                  Contraseña de Acceso
                </label>
                <input
                  type="password"
                  value={newUserPass}
                  onChange={(e) => setNewUserPass(e.target.value)}
                  placeholder="mínimo 4 caracteres"
                  required
                  minLength={4}
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px', padding: '0 12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
                  PIN Rápido (4 a 6 dígitos para login)
                </label>
                <input
                  type="password"
                  inputMode="decimal"
                  maxLength={6}
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="4 a 6 dígitos"
                  required
                  minLength={4}
                  className="input-field"
                  style={{ width: '100%', minHeight: '44px', padding: '0 12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewUserModal(false)}
                  className="btn btn-outline"
                  style={{ minHeight: '44px', padding: '0 16px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="btn btn-primary"
                  style={{ minHeight: '44px', padding: '0 16px' }}
                >
                  {isCreatingUser ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
