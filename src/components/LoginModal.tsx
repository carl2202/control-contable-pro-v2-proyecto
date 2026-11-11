// ============================================================
// LoginModal.tsx
// Modal / pantalla de inicio de sesión con teclado numérico
// y funcionalidad para cambio seguro de contraseñas (Dueño).
//
// Props:
//   isOpen     — controla si el modal está visible.
//   onClose    — función que cierra el modal (sin sesión iniciada).
//   isEmbedded — cuando es true, elimina el overlay de fondo y el
//                botón "Cancelar" (pantalla de bloqueo obligatoria).
// ============================================================
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { AuthService } from '../services/auth.service';
import { Role } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Si es true el formulario se renderiza dentro de la tarjeta
   *  de la pantalla de bloqueo (sin overlay flotante). */
  isEmbedded?: boolean;
}

export function LoginModal({ isOpen, onClose, isEmbedded = false }: LoginModalProps) {
  // Hooks de autenticación y notificaciones
  const { loginWithPin } = useAuth();
  const { showToast } = useFeedback();

  // ── Modo de vista (login o cambio de contraseña) ────────────
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);

  // ── Estado del formulario de Login ──────────────────────────
  // Rol seleccionado por el usuario (dueno | empleado)
  const [selectedRole, setSelectedRole] = useState<Role>('dueno');
  // PIN ingresado — comienza vacío por seguridad (no se pre-rellena)
  const [pin, setPin] = useState<string>('');
  // Mensaje de error para feedback visual inmediato
  const [errorMsg, setErrorMsg] = useState<string>('');
  // Bloqueo durante la petición async al servidor
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ── Estado del formulario de Cambio de Contraseña ──────────
  const [targetChangeRole, setTargetChangeRole] = useState<Role>('dueno');
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showOldPass, setShowOldPass] = useState<boolean>(false);
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [changeErrorMsg, setChangeErrorMsg] = useState<string>('');
  const [isSavingPass, setIsSavingPass] = useState<boolean>(false);

  // Limpiar PIN y error cada vez que el modal se abre
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMsg('');
      setChangeErrorMsg('');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    }
  }, [isOpen]);

  // Si el modal está cerrado y no es embebido, no renderizar nada
  if (!isOpen && !isEmbedded) return null;

  // ── Cambio de rol en login ──────────────────────────────────
  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setPin('');
    setErrorMsg('');
  };

  // ── Teclado numérico táctil ────────────────────────────────
  const handleKeypadPress = (val: string) => {
    setErrorMsg('');
    if (val === 'CLEAR') {
      setPin('');
    } else if (val === 'DEL') {
      setPin((prev) => prev.slice(0, -1));
    } else if (pin.length < 8) {
      setPin((prev) => prev + val);
    }
  };

  // ── Envío de login ─────────────────────────────────────────
  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pin) {
      setErrorMsg('Por favor ingrese su PIN de acceso.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await loginWithPin(pin, selectedRole);
      if (res.success) {
        showToast(
          `Bienvenido. Sesión iniciada como ${selectedRole === 'dueno' ? 'Dueño / Admin' : 'Empleado / Cajero'}.`,
          false,
          'success'
        );
        onClose();
      } else {
        setErrorMsg(res.error || 'PIN incorrecto. Intente nuevamente.');
        setPin('');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión con el servidor de autenticación.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Envío de cambio de contraseña ──────────────────────────
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oldPassword.trim()) {
      setChangeErrorMsg('Es obligatorio ingresar la contraseña actual (antigua) para autorizar el cambio.');
      return;
    }

    if (newPassword.trim().length < 4) {
      setChangeErrorMsg('La nueva contraseña o PIN debe contener al menos 4 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangeErrorMsg('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setIsSavingPass(true);
    setChangeErrorMsg('');

    try {
      const res = await AuthService.changePassword({
        targetRole: targetChangeRole,
        oldPassword: oldPassword.trim(),
        newPassword: newPassword.trim(),
      });

      if (res.success) {
        showToast(
          res.message || 'Contraseña actualizada correctamente. Ingrese con su nueva clave.',
          false,
          'success'
        );
        // Regresar a login y limpiar campos
        setIsChangingPassword(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPin('');
      }
    } catch (err: any) {
      setChangeErrorMsg(err.message || 'Error al cambiar la contraseña. Verifique que la contraseña antigua sea correcta.');
    } finally {
      setIsSavingPass(false);
    }
  };

  // ── Vista de Cambio de Contraseña ─────────────────────────
  const changePasswordContent = (
    <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => {
            setIsChangingPassword(false);
            setChangeErrorMsg('');
          }}
          className="btn btn-light"
          style={{ fontSize: '0.74rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Volver al Login
        </button>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.04em' }}>
          SEGURIDAD • AUTORIZACIÓN
        </span>
      </div>

      <div style={{ background: '#F2F6EE', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid #CBDCC5', fontSize: '0.75rem', color: '#2F4A38', lineHeight: 1.4 }}>
        <b>Nota de seguridad:</b> El Dueño puede cambiar la clave de acceso tanto de Jefe como de Empleado. Debe ingresar obligatoriamente la contraseña actual para autorizar la modificación.
      </div>

      {/* Selector de Perfil a Cambiar */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '0.74rem',
            fontWeight: 600,
            color: 'var(--text-body)',
            marginBottom: '8px',
          }}
        >
          Perfil al que se cambiará la contraseña:
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              setTargetChangeRole('dueno');
              setChangeErrorMsg('');
            }}
            style={{
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${targetChangeRole === 'dueno' ? 'var(--primary)' : 'var(--border)'}`,
              background: targetChangeRole === 'dueno' ? 'var(--primary-light)' : 'var(--surface)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition-smooth)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-main)' }}>
              👑 Dueño / Jefe
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Acceso total
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setTargetChangeRole('empleado');
              setChangeErrorMsg('');
            }}
            style={{
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${targetChangeRole === 'empleado' ? 'var(--primary)' : 'var(--border)'}`,
              background: targetChangeRole === 'empleado' ? 'var(--primary-light)' : 'var(--surface)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition-smooth)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-main)' }}>
              💼 Cajero / Empleado
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Turnos y ventas
            </div>
          </button>
        </div>
      </div>

      {/* Campo: Contraseña Actual (Antigua Obligatoria) */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label
          style={{
            display: 'block',
            fontSize: '0.74rem',
            fontWeight: 600,
            color: 'var(--text-body)',
            marginBottom: '4px',
          }}
        >
          Contraseña o PIN actual (Antigua obligatoria para autorizar):
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showOldPass ? 'text' : 'password'}
            value={oldPassword}
            onChange={(e) => {
              setOldPassword(e.target.value);
              setChangeErrorMsg('');
            }}
            placeholder="Ingrese la contraseña actual..."
            required
            style={{
              width: '100%',
              padding: '9px 38px 9px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => setShowOldPass(!showOldPass)}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
            }}
            title={showOldPass ? 'Ocultar' : 'Mostrar'}
          >
            {showOldPass ? '🙈' : '👁️'}
          </button>
        </div>
        <small style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          Obligatorio para verificar la identidad antes de cualquier cambio.
        </small>
      </div>

      {/* Campo: Nueva Contraseña */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label
          style={{
            display: 'block',
            fontSize: '0.74rem',
            fontWeight: 600,
            color: 'var(--text-body)',
            marginBottom: '4px',
          }}
        >
          Nueva contraseña o PIN (mínimo 4 caracteres):
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showNewPass ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setChangeErrorMsg('');
            }}
            placeholder="Nueva contraseña o PIN..."
            required
            minLength={4}
            style={{
              width: '100%',
              padding: '9px 38px 9px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => setShowNewPass(!showNewPass)}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
            }}
            title={showNewPass ? 'Ocultar' : 'Mostrar'}
          >
            {showNewPass ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      {/* Campo: Confirmar Nueva Contraseña */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label
          style={{
            display: 'block',
            fontSize: '0.74rem',
            fontWeight: 600,
            color: 'var(--text-body)',
            marginBottom: '4px',
          }}
        >
          Confirmar nueva contraseña o PIN:
        </label>
        <input
          type={showNewPass ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setChangeErrorMsg('');
          }}
          placeholder="Repita la nueva contraseña..."
          required
          minLength={4}
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${
              confirmPassword && confirmPassword !== newPassword ? 'var(--danger)' : 'var(--border)'
            }`,
            background: 'var(--surface)',
            color: 'var(--text-main)',
            fontSize: '0.85rem',
            outline: 'none',
          }}
        />
      </div>

      {/* Mensaje de error de validación */}
      {changeErrorMsg && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderLeft: '4px solid var(--danger)',
            color: '#7E3F27',
            fontSize: '0.76rem',
            lineHeight: 1.4,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{changeErrorMsg}</span>
        </div>
      )}

      {/* Botones de acción */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '6px' }}>
        <button
          type="button"
          className="btn btn-light"
          onClick={() => {
            setIsChangingPassword(false);
            setChangeErrorMsg('');
          }}
          disabled={isSavingPass}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSavingPass || !oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()}
          style={{ minWidth: '150px', justifyContent: 'center' }}
        >
          {isSavingPass ? 'Actualizando...' : 'Actualizar Contraseña'}
        </button>
      </div>
    </form>
  );

  // ── Contenido del formulario de Login ──────────────────────
  const loginContent = (
    <form onSubmit={handleSubmitLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ── Selector de perfil / rol ── */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-body)',
            marginBottom: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Seleccione el perfil de acceso:
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {/* Tarjeta Dueño */}
          <button
            type="button"
            onClick={() => handleSelectRole('dueno')}
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${selectedRole === 'dueno' ? 'var(--primary)' : 'var(--border)'}`,
              background: selectedRole === 'dueno' ? 'var(--primary-light)' : 'var(--surface)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition-smooth)',
              boxShadow: selectedRole === 'dueno' ? '0 0 0 3px var(--primary-glow)' : 'none',
            }}
            aria-pressed={selectedRole === 'dueno'}
          >
            {/* Ícono de corona SVG */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 20h20M5 20V10l7-7 7 7v10" />
                <path d="M12 20v-6" />
              </svg>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Dueño / Admin
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Acceso total al sistema
            </span>
          </button>

          {/* Tarjeta Empleado */}
          <button
            type="button"
            onClick={() => handleSelectRole('empleado')}
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${selectedRole === 'empleado' ? 'var(--primary)' : 'var(--border)'}`,
              background: selectedRole === 'empleado' ? 'var(--primary-light)' : 'var(--surface)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition-smooth)',
              boxShadow: selectedRole === 'empleado' ? '0 0 0 3px var(--primary-glow)' : 'none',
            }}
            aria-pressed={selectedRole === 'empleado'}
          >
            {/* Ícono de maletín SVG */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <line x1="12" y1="12" x2="12" y2="17" />
                <line x1="9" y1="14.5" x2="15" y2="14.5" />
              </svg>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Cajero / Empleado
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Ventas y operaciones de caja
            </span>
          </button>
        </div>
      </div>

      {/* ── Campo de PIN con indicador de puntos ── */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-body)',
            marginBottom: '8px',
          }}
          htmlFor="login-pin-input"
        >
          Ingrese su PIN de seguridad:
        </label>

        {/* Visualizador de puntos */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '14px 16px',
            background: 'var(--surface-alt)',
            border: `1px solid ${errorMsg ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            marginBottom: '10px',
            minHeight: '52px',
            transition: 'var(--transition-smooth)',
          }}
          aria-live="polite"
          aria-label={`${pin.length} dígitos ingresados`}
        >
          {pin.length === 0 ? (
            <span style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>
              Ingrese su PIN usando el teclado
            </span>
          ) : (
            Array.from({ length: pin.length }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: errorMsg ? 'var(--danger)' : 'var(--primary)',
                  display: 'inline-block',
                  transition: 'background 0.2s',
                }}
              />
            ))
          )}
        </div>

        {/* Input oculto para accesibilidad y entrada por teclado físico */}
        <input
          id="login-pin-input"
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
            setErrorMsg('');
          }}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: '1px', width: '1px' }}
          aria-hidden="true"
          autoFocus={isEmbedded}
        />
      </div>

      {/* ── Teclado numérico táctil (3×4) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
        }}
      >
        {/* Teclas 1–9 */}
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleKeypadPress(num)}
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-main)',
              fontSize: '1.1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition-smooth)',
              fontFamily: 'var(--font-mono)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
          >
            {num}
          </button>
        ))}

        {/* Tecla Borrar todo */}
        <button
          type="button"
          onClick={() => handleKeypadPress('CLEAR')}
          style={{
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: 'var(--danger)',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'var(--transition-smooth)',
            letterSpacing: '0.03em',
          }}
          title="Borrar todo"
          aria-label="Borrar todo el PIN"
        >
          CLR
        </button>

        {/* Tecla 0 */}
        <button
          type="button"
          onClick={() => handleKeypadPress('0')}
          style={{
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-main)',
            fontSize: '1.1rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-smooth)',
            fontFamily: 'var(--font-mono)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
        >
          0
        </button>

        {/* Tecla Borrar último dígito */}
        <button
          type="button"
          onClick={() => handleKeypadPress('DEL')}
          style={{
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-alt)',
            border: '1px solid var(--border)',
            color: 'var(--text-body)',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-smooth)',
          }}
          title="Borrar último dígito"
          aria-label="Borrar último dígito"
        >
          ⌫
        </button>
      </div>

      {/* ── Mensaje de error ── */}
      {errorMsg && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderLeft: '4px solid var(--danger)',
            color: '#7E3F27',
            fontSize: '0.82rem',
            lineHeight: 1.45,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Botones de acción ── */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
        {!isEmbedded && (
          <button
            type="button"
            className="btn btn-light"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </button>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading || pin.length === 0}
          style={{ flex: isEmbedded ? 1 : undefined, minWidth: '140px', justifyContent: 'center' }}
        >
          {isLoading ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round"
                style={{ animation: 'spin 0.8s linear infinite' }} aria-hidden="true">
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
              </svg>
              Verificando...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Acceder al Sistema
            </>
          )}
        </button>
      </div>

      {/* ── Enlace para cambiar contraseñas (Dueño) ── */}
      <div style={{ textAlign: 'center', marginTop: '6px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
        <button
          type="button"
          onClick={() => {
            setIsChangingPassword(true);
            setChangeErrorMsg('');
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
          }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'var(--primary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            transition: 'var(--transition-smooth)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary-dark)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--primary)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-1.5 1.5L20 7l-3 3-1.5-1.5M10 14l-4 4-2-2 4-4m1.5-1.5L12 8l4 4-1.5 1.5M7 17l-5 5"/>
          </svg>
          ¿Desea cambiar contraseña / PIN? (Dueño)
        </button>
      </div>
    </form>
  );

  const activeContent = isChangingPassword ? changePasswordContent : loginContent;

  // ── Modo embebido: sin overlay flotante ────────────────────
  if (isEmbedded) {
    return activeContent;
  }

  // ── Modo modal flotante: con overlay y tarjeta centrada ────
  return (
    <div
      className="dlg-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Inicio de sesión"
    >
      <div className="dlg" style={{ maxWidth: '440px', width: '100%' }}>
        {/* Cabecera del modal */}
        <div className="dlg-head">
          <div className="dlg-ico">
            {isChangingPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 2l-2 2m-1.5 1.5L20 7l-3 3-1.5-1.5M10 14l-4 4-2-2 4-4m1.5-1.5L12 8l4 4-1.5 1.5M7 17l-5 5"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
          </div>
          <h2 className="dlg-title">
            {isChangingPassword ? 'Cambio Seguro de Contraseña' : 'Acceso al Sistema / Cambio de Rol'}
          </h2>
          {/* Botón cerrar */}
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Cerrar"
            aria-label="Cerrar ventana de inicio de sesión"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Cuerpo del modal con el formulario activo */}
        <div className="dlg-body">
          {activeContent}
        </div>
      </div>
    </div>
  );
}
