// ============================================================
// LoginModal.tsx
// Modal y pantalla de inicio de sesión con teclado numérico,
// acceso sin contraseña (OTP por correo o teléfono),
// recuperación de cuenta, cambio seguro de contraseña y
// detección automática de dispositivo (móvil vs escritorio).
// ============================================================
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { useDevice } from '../context/DeviceContext';
import { AuthService } from '../services/auth.service';
import { Role } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEmbedded?: boolean;
}

export function LoginModal({ isOpen, onClose, isEmbedded = false }: LoginModalProps) {
  const { loginWithPin, loginWithOtp, registerUser } = useAuth();
  const { showToast } = useFeedback();
  const { isMobile: isMobileDevice } = useDevice();

  // ── Modos de vista: login (PIN), otp (sin clave), recover (recuperación), changePassword, register ──
  const [viewMode, setViewMode] = useState<'login' | 'otp' | 'recover' | 'changePassword' | 'register'>('login');
  const isChangingPassword = viewMode === 'changePassword';

  // ── Estado: Login con PIN ──────────────────────────────────
  const [selectedRole, setSelectedRole] = useState<Role>('dueno');
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ── Estado: Login sin contraseña (OTP) ─────────────────────
  const [otpTarget, setOtpTarget] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpStep, setOtpStep] = useState<'send' | 'verify'>('send');
  const [generatedOtpHint, setGeneratedOtpHint] = useState<string>('');
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [otpErrorMsg, setOtpErrorMsg] = useState<string>('');

  // ── Estado: Recuperación de Cuenta ─────────────────────────
  const [recoverTarget, setRecoverTarget] = useState<string>('');
  const [recoverCode, setRecoverCode] = useState<string>('');
  const [recoverNewPassword, setRecoverNewPassword] = useState<string>('');
  const [recoverConfirmPass, setRecoverConfirmPass] = useState<string>('');
  const [recoverStep, setRecoverStep] = useState<'request' | 'reset'>('request');
  const [isSubmittingRecover, setIsSubmittingRecover] = useState<boolean>(false);
  const [recoverErrorMsg, setRecoverErrorMsg] = useState<string>('');

  // ── Estado: Cambio de Contraseña (Dueño) ────────────────────
  const [targetChangeRole, setTargetChangeRole] = useState<Role>('dueno');
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showOldPass, setShowOldPass] = useState<boolean>(false);
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [changeErrorMsg, setChangeErrorMsg] = useState<string>('');
  const [isSavingPass, setIsSavingPass] = useState<boolean>(false);

  // ── Estado: Registro de Nuevo Negocio ──────────────────────
  const [regBusinessName, setRegBusinessName] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regPin, setRegPin] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [regRecoveryType, setRegRecoveryType] = useState<'email' | 'phone'>('email');
  const [regRecoveryValue, setRegRecoveryValue] = useState<string>('');
  const [regErrorMsg, setRegErrorMsg] = useState<string>('');
  const [isSubmittingReg, setIsSubmittingReg] = useState<boolean>(false);

  // Limpiar campos al abrir
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMsg('');
      setOtpErrorMsg('');
      setRecoverErrorMsg('');
      setGeneratedOtpHint('');
      setChangeErrorMsg('');
      setRegErrorMsg('');
      setOtpStep('send');
      setRecoverStep('request');
      setViewMode('login');
    }
  }, [isOpen]);

  if (!isOpen && !isEmbedded) return null;

  // ── Handlers Login PIN ─────────────────────────────────────
  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setPin('');
    setErrorMsg('');
  };

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

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      setErrorMsg('Por favor ingrese su PIN de acceso.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await loginWithPin(pin, selectedRole, loginUsername.trim() || undefined);
      if (res.success) {
        showToast(
          `Sesión iniciada como ${selectedRole === 'dueno' ? 'Dueño / Administrador' : 'Empleado / Cajero'}.`,
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

  // ── Handlers OTP (Sin Contraseña) ──────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = otpTarget.trim();
    if (!clean) {
      setOtpErrorMsg('Ingrese un correo electrónico o número de teléfono registrado.');
      return;
    }
    setIsSendingOtp(true);
    setOtpErrorMsg('');
    try {
      const res = await AuthService.sendOtp(clean);
      if (res.success) {
        setOtpStep('verify');
        if (res.code) setGeneratedOtpHint(res.code);
        showToast(res.message || 'Código de acceso generado correctamente.', false, 'success');
      }
    } catch (err: any) {
      setOtpErrorMsg(err.message || 'No se pudo enviar el código. Verifique sus datos.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otpCode.trim();
    if (!cleanCode) {
      setOtpErrorMsg('Ingrese el código de 6 dígitos recibido.');
      return;
    }
    setIsVerifyingOtp(true);
    setOtpErrorMsg('');
    try {
      const res = await loginWithOtp(otpTarget.trim(), cleanCode);
      if (res.success) {
        showToast('Acceso verificado con éxito. Bienvenido al sistema.', false, 'success');
        onClose();
      } else {
        setOtpErrorMsg(res.error || 'Código incorrecto o expirado.');
      }
    } catch (err: any) {
      setOtpErrorMsg(err.message || 'Error al verificar código.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // ── Handlers Recuperación de Cuenta ────────────────────────
  const handleRequestRecoverOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = recoverTarget.trim();
    if (!clean) {
      setRecoverErrorMsg('Ingrese el correo electrónico o teléfono de su cuenta.');
      return;
    }
    setIsSubmittingRecover(true);
    setRecoverErrorMsg('');
    try {
      const res = await AuthService.sendOtp(clean);
      if (res.success) {
        setRecoverStep('reset');
        showToast('Código de recuperación generado.', false, 'success');
      }
    } catch (err: any) {
      setRecoverErrorMsg(err.message || 'No se encontró la cuenta con los datos indicados.');
    } finally {
      setIsSubmittingRecover(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverCode.trim()) {
      setRecoverErrorMsg('Ingrese el código de verificación.');
      return;
    }
    if (!/^\d{4,6}$/.test(recoverNewPassword)) {
      setRecoverErrorMsg('El nuevo PIN debe contener entre 4 y 6 dígitos.');
      return;
    }
    if (recoverNewPassword !== recoverConfirmPass) {
      setRecoverErrorMsg('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    setIsSubmittingRecover(true);
    setRecoverErrorMsg('');
    try {
      const res = await AuthService.recoverAccount({
        target: recoverTarget.trim(),
        code: recoverCode.trim(),
        newPassword: recoverNewPassword.trim(),
      });
      if (res.success) {
        showToast('Contraseña restablecida con éxito. Ingrese con sus nuevas credenciales.', false, 'success');
        setViewMode('login');
        setPin('');
      }
    } catch (err: any) {
      setRecoverErrorMsg(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setIsSubmittingRecover(false);
    }
  };

  // ── Handlers Cambio de Contraseña (Dueño) ───────────────────
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword.trim()) {
      setChangeErrorMsg('Ingrese la contraseña actual para autorizar el cambio.');
      return;
    }
    if (newPassword.trim().length < 4) {
      setChangeErrorMsg('La nueva clave debe tener al menos 4 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeErrorMsg('Las contraseñas no coinciden.');
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
        showToast(res.message || 'Contraseña actualizada con éxito.', false, 'success');
        setViewMode('login');
      }
    } catch (err: any) {
      setChangeErrorMsg(err.message || 'Error al cambiar contraseña.');
    } finally {
      setIsSavingPass(false);
    }
  };

  // ── Handlers Registro ──────────────────────────────────────
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const recoveryValue = regRecoveryValue.trim();
    if (!recoveryValue) {
      setRegErrorMsg(regRecoveryType === 'email'
        ? 'Ingrese un correo electrónico para recuperar la cuenta.'
        : 'Ingrese un número telefónico para recuperar la cuenta.');
      return;
    }
    if (regRecoveryType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryValue)) {
      setRegErrorMsg('Ingrese un correo electrónico válido.');
      return;
    }
    if (regRecoveryType === 'phone' && recoveryValue.replace(/\D/g, '').length < 8) {
      setRegErrorMsg('Ingrese un número telefónico válido de al menos 8 dígitos.');
      return;
    }
    if (regPassword.length < 6) {
      setRegErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!/^\d{4,6}$/.test(regPin)) {
      setRegErrorMsg('El PIN debe contener entre 4 y 6 dígitos.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegErrorMsg('Las contraseñas no coinciden.');
      return;
    }
    setIsSubmittingReg(true);
    setRegErrorMsg('');
    try {
      const res = await registerUser({
        username: regUsername.trim(),
        password: regPassword.trim(),
        pin: regPin,
        businessName: regBusinessName.trim(),
        email: regRecoveryType === 'email' ? recoveryValue : undefined,
        phone: regRecoveryType === 'phone' ? recoveryValue.replace(/\D/g, '') : undefined,
      });
      if (res.success) {
        showToast(`Negocio ${regBusinessName} registrado con éxito.`, false, 'success');
        onClose();
      } else {
        setRegErrorMsg(res.error || 'Error al registrar la cuenta.');
      }
    } catch (err: any) {
      setRegErrorMsg(err.message || 'Error en el servidor de registro.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  // ── Barra de Selección de Modo (Pestañas Superiores) ───────
  const navigationTabs = (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        padding: '3px',
        background: 'var(--surface-alt)',
        borderRadius: 'var(--radius-md)',
        marginBottom: '14px',
        border: '1px solid var(--border)',
      }}
    >
      <button
        type="button"
        onClick={() => {
          setViewMode('login');
          setErrorMsg('');
        }}
        style={{
          flex: 1,
          padding: isMobileDevice ? '10px 4px' : '7px 8px',
          fontSize: '0.74rem',
          fontWeight: viewMode === 'login' ? 700 : 500,
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          background: viewMode === 'login' ? 'var(--surface)' : 'transparent',
          color: viewMode === 'login' ? 'var(--primary)' : 'var(--text-muted)',
          boxShadow: viewMode === 'login' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          cursor: 'pointer',
          transition: 'all 0.16s ease',
          textAlign: 'center',
          minHeight: isMobileDevice ? '44px' : '32px',
        }}
      >
        PIN de Seguridad
      </button>

      <button
        type="button"
        onClick={() => {
          setViewMode('otp');
          setOtpErrorMsg('');
          setOtpStep('send');
        }}
        style={{
          flex: 1,
          padding: isMobileDevice ? '10px 4px' : '7px 8px',
          fontSize: '0.74rem',
          fontWeight: viewMode === 'otp' ? 700 : 500,
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          background: viewMode === 'otp' ? 'var(--surface)' : 'transparent',
          color: viewMode === 'otp' ? 'var(--primary)' : 'var(--text-muted)',
          boxShadow: viewMode === 'otp' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          cursor: 'pointer',
          transition: 'all 0.16s ease',
          textAlign: 'center',
          minHeight: isMobileDevice ? '44px' : '32px',
        }}
      >
        Código OTP
      </button>

      <button
        type="button"
        onClick={() => {
          setViewMode('recover');
          setRecoverErrorMsg('');
          setRecoverStep('request');
        }}
        style={{
          flex: 1,
          padding: isMobileDevice ? '10px 4px' : '7px 8px',
          fontSize: '0.74rem',
          fontWeight: viewMode === 'recover' ? 700 : 500,
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          background: viewMode === 'recover' ? 'var(--surface)' : 'transparent',
          color: viewMode === 'recover' ? 'var(--primary)' : 'var(--text-muted)',
          boxShadow: viewMode === 'recover' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          cursor: 'pointer',
          transition: 'all 0.16s ease',
          textAlign: 'center',
          minHeight: isMobileDevice ? '44px' : '32px',
        }}
      >
        Recuperar
      </button>
    </div>
  );

  // ── Vista: Login con PIN ───────────────────────────────────
  const loginContent = (
    <form onSubmit={handleSubmitLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {navigationTabs}

      {/* Selector de Perfil */}
      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '8px' }}>
          Perfil de acceso:
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleSelectRole('dueno')}
            style={{
              padding: isMobileDevice ? '12px' : '10px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${selectedRole === 'dueno' ? 'var(--primary)' : 'var(--border)'}`,
              background: selectedRole === 'dueno' ? 'var(--primary-light)' : 'var(--surface)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.18s ease',
              minHeight: '48px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3 6 6 1-4.5 4.5 1 6.5L12 17l-5.5 3 1-6.5L3 9l6-1z"/>
              </svg>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Dueño / Admin</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>Acceso total</div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectRole('empleado')}
            style={{
              padding: isMobileDevice ? '12px' : '10px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${selectedRole === 'empleado' ? 'var(--primary)' : 'var(--border)'}`,
              background: selectedRole === 'empleado' ? 'var(--primary-light)' : 'var(--surface)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.18s ease',
              minHeight: '48px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Cajero / Empleado</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>Caja y ventas</div>
          </button>
        </div>
      </div>

      {/* Usuario opcional para desambiguar PIN compartidos entre negocios */}
      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '6px' }}>
          Usuario del negocio (opcional):
        </label>
        <input
          type="text"
          value={loginUsername}
          onChange={(e) => setLoginUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder="Ej. roberto_admin"
          className="input-field"
          style={{ width: '100%', minHeight: '44px', padding: '0 12px', fontFamily: 'var(--font-mono)' }}
        />
      </div>

      {/* Visualizador de PIN */}
      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '6px' }}>
          PIN de seguridad ({selectedRole === 'dueno' ? 'Dueño: 1234' : 'Cajero: 0000'}):
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '12px',
            background: 'var(--surface-alt)',
            border: `1px solid ${errorMsg ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            minHeight: '48px',
          }}
        >
          {pin.length === 0 ? (
            <span style={{ color: 'var(--text-subtle)', fontSize: '0.78rem' }}>
              {isMobileDevice ? 'Toque los números para marcar' : 'Ingrese su PIN de 4 dígitos'}
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
                }}
              />
            ))
          )}
        </div>

        {/* Input accesible para teclado físico */}
        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
            setErrorMsg('');
          }}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: '1px', width: '1px' }}
          autoFocus={isEmbedded && !isMobileDevice}
        />
      </div>

      {/* Teclado numérico táctil */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleKeypadPress(num)}
            style={{
              padding: isMobileDevice ? '14px' : '10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-main)',
              fontSize: '1.1rem',
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: '44px',
              touchAction: 'manipulation',
            }}
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleKeypadPress('CLEAR')}
          style={{
            padding: isMobileDevice ? '14px' : '10px',
            borderRadius: 'var(--radius-md)',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: 'var(--danger)',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          BORRAR
        </button>
        <button
          type="button"
          onClick={() => handleKeypadPress('0')}
          style={{
            padding: isMobileDevice ? '14px' : '10px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-main)',
            fontSize: '1.1rem',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          0
        </button>
        <button
          type="button"
          onClick={() => handleKeypadPress('DEL')}
          style={{
            padding: isMobileDevice ? '14px' : '10px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-alt)',
            border: '1px solid var(--border)',
            color: 'var(--text-body)',
            fontSize: '1.1rem',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          ⌫
        </button>
      </div>

      {errorMsg && (
        <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', color: '#7E3F27', fontSize: '0.78rem' }}>
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || pin.length === 0}
        className="btn btn-primary"
        style={{ minHeight: '44px', width: '100%', fontWeight: 700 }}
      >
        {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
      </button>

      {/* Enlaces de pie de modal */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'center', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => setViewMode('changePassword')}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
        >
          Cambiar Contraseña / PIN (Dueño)
        </button>
        <button
          type="button"
          onClick={() => setViewMode('register')}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
        >
          ¿Nuevo negocio? Crear cuenta en la nube
        </button>
      </div>
    </form>
  );

  // ── Vista: Acceso sin Contraseña (OTP) ─────────────────────
  const otpContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {navigationTabs}

      <div style={{ background: '#F2F6EE', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid #CBDCC5', fontSize: '0.75rem', color: '#2F4A38', lineHeight: 1.4 }}>
        <b>Acceso sin Contraseña:</b> Ingrese su correo o número telefónico registrado para generar y verificar un código temporal de 6 dígitos.
      </div>

      {otpStep === 'send' ? (
        <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
              Correo electrónico o número de teléfono:
            </label>
            <input
              type="text"
              value={otpTarget}
              onChange={(e) => {
                setOtpTarget(e.target.value);
                setOtpErrorMsg('');
              }}
              placeholder="ej. admin@tienda.com o 70001122"
              required
              className="input-field"
              style={{ width: '100%', minHeight: '44px', padding: '0 12px', fontSize: '0.88rem' }}
            />
            <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Cuentas demo activas: <code>admin@tienda.com</code> (Dueño) y <code>cajero@tienda.com</code> (Cajero).
            </small>
          </div>

          {otpErrorMsg && (
            <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', color: '#7E3F27', fontSize: '0.78rem' }}>
              {otpErrorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSendingOtp}
            className="btn btn-primary"
            style={{ minHeight: '44px', width: '100%', fontWeight: 700 }}
          >
            {isSendingOtp ? 'Generando Código...' : 'Enviar Código de Verificación'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {generatedOtpHint && (
            <div style={{ background: '#E1EBDC', border: '1px solid #4F6F52', padding: '10px 14px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#2F4A38', display: 'block' }}>Modo demostración — código generado:</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1B3122', letterSpacing: '4px', fontFamily: 'var(--font-mono)' }}>
                {generatedOtpHint}
              </span>
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
              Ingrese el código de 6 dígitos:
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => {
                setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setOtpErrorMsg('');
              }}
              placeholder="123456"
              required
              className="input-field"
              style={{
                width: '100%',
                minHeight: '44px',
                padding: '0 12px',
                textAlign: 'center',
                letterSpacing: '4px',
                fontSize: '1.2rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          {otpErrorMsg && (
            <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', color: '#7E3F27', fontSize: '0.78rem' }}>
              {otpErrorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isVerifyingOtp || otpCode.length < 4}
            className="btn btn-primary"
            style={{ minHeight: '44px', width: '100%', fontWeight: 700 }}
          >
            {isVerifyingOtp ? 'Comprobando...' : 'Verificar e Iniciar Sesión'}
          </button>

          <button
            type="button"
            onClick={() => setOtpStep('send')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', textAlign: 'center' }}
          >
            ← Probar con otro correo o teléfono
          </button>
        </form>
      )}
    </div>
  );

  // ── Vista: Recuperación de Cuenta ─────────────────────────
  const recoverContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {navigationTabs}

      <div style={{ background: '#F2F6EE', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid #CBDCC5', fontSize: '0.75rem', color: '#2F4A38', lineHeight: 1.4 }}>
        <b>Recuperación de Contraseña:</b> Genere un código de verificación por correo o teléfono para actualizar su contraseña o PIN de forma segura.
      </div>

      {recoverStep === 'request' ? (
        <form onSubmit={handleRequestRecoverOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
              Correo electrónico o teléfono de la cuenta:
            </label>
            <input
              type="text"
              value={recoverTarget}
              onChange={(e) => {
                setRecoverTarget(e.target.value);
                setRecoverErrorMsg('');
              }}
              placeholder="ej. admin@tienda.com o 70001122"
              required
              className="input-field"
              style={{ width: '100%', minHeight: '44px', padding: '0 12px' }}
            />
          </div>

          {recoverErrorMsg && (
            <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', color: '#7E3F27', fontSize: '0.78rem' }}>
              {recoverErrorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmittingRecover}
            className="btn btn-primary"
            style={{ minHeight: '44px', width: '100%', fontWeight: 700 }}
          >
            {isSubmittingRecover ? 'Buscando Cuenta...' : 'Enviar Código de Recuperación'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
              Código de 6 dígitos:
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={recoverCode}
              onChange={(e) => setRecoverCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              required
              className="input-field"
              style={{ width: '100%', minHeight: '40px', padding: '0 10px', textAlign: 'center', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
              Nueva contraseña o PIN (mínimo 4 caracteres):
            </label>
            <input
              type="password"
              value={recoverNewPassword}
              onChange={(e) => setRecoverNewPassword(e.target.value)}
              placeholder="Nueva clave..."
              required
              minLength={4}
              className="input-field"
              style={{ width: '100%', minHeight: '40px', padding: '0 10px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
              Confirmar nueva contraseña:
            </label>
            <input
              type="password"
              value={recoverConfirmPass}
              onChange={(e) => setRecoverConfirmPass(e.target.value)}
              placeholder="Repita la clave..."
              required
              minLength={4}
              className="input-field"
              style={{ width: '100%', minHeight: '40px', padding: '0 10px' }}
            />
          </div>

          {recoverErrorMsg && (
            <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', color: '#7E3F27', fontSize: '0.78rem' }}>
              {recoverErrorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmittingRecover}
            className="btn btn-primary"
            style={{ minHeight: '44px', width: '100%', fontWeight: 700 }}
          >
            {isSubmittingRecover ? 'Actualizando...' : 'Restablecer Clave y Acceder'}
          </button>
        </form>
      )}
    </div>
  );

  // ── Vista: Cambio Seguro de Contraseña (Dueño) ─────────────
  const changePasswordContent = (
    <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => setViewMode('login')}
          className="btn btn-light"
          style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          ← Volver
        </button>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)' }}>
          CAMBIO DE CLAVE
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setTargetChangeRole('dueno')}
          style={{
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            border: `2px solid ${targetChangeRole === 'dueno' ? 'var(--primary)' : 'var(--border)'}`,
            background: targetChangeRole === 'dueno' ? 'var(--primary-light)' : 'var(--surface)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-main)' }}>Dueño / Jefe</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Acceso total</div>
        </button>

        <button
          type="button"
          onClick={() => setTargetChangeRole('empleado')}
          style={{
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            border: `2px solid ${targetChangeRole === 'empleado' ? 'var(--primary)' : 'var(--border)'}`,
            background: targetChangeRole === 'empleado' ? 'var(--primary-light)' : 'var(--surface)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-main)' }}>Cajero / Empleado</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Ventas y caja</div>
        </button>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
          Contraseña o PIN actual:
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showOldPass ? 'text' : 'password'}
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="Clave actual..."
            required
            className="input-field"
            style={{ width: '100%', minHeight: '40px', padding: '0 36px 0 10px' }}
          />
          <button
            type="button"
            onClick={() => setShowOldPass(!showOldPass)}
            style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
          Nueva contraseña o PIN (mínimo 4 caracteres):
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showNewPass ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nueva clave..."
            required
            minLength={4}
            className="input-field"
            style={{ width: '100%', minHeight: '40px', padding: '0 36px 0 10px' }}
          />
          <button
            type="button"
            onClick={() => setShowNewPass(!showNewPass)}
            style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
          Confirmar nueva clave:
        </label>
        <input
          type={showNewPass ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repita la clave..."
          required
          minLength={4}
          className="input-field"
          style={{ width: '100%', minHeight: '40px', padding: '0 10px' }}
        />
      </div>

      {changeErrorMsg && (
        <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', color: '#7E3F27', fontSize: '0.78rem' }}>
          {changeErrorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={isSavingPass}
        className="btn btn-primary"
        style={{ minHeight: '44px', width: '100%', fontWeight: 700 }}
      >
        {isSavingPass ? 'Guardando...' : 'Actualizar Contraseña'}
      </button>
    </form>
  );

  // ── Vista: Registro de Negocio ─────────────────────────────
  const registerContent = (
    <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => setViewMode('login')}
          className="btn btn-light"
          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
        >
          ← Volver
        </button>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)' }}>
          NUEVA TIENDA
        </span>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
          Nombre de la Tienda / Negocio:
        </label>
        <input
          type="text"
          value={regBusinessName}
          onChange={(e) => setRegBusinessName(e.target.value)}
          placeholder="ej. Boutique La Elegancia"
          required
          className="input-field"
          style={{ width: '100%', minHeight: '40px', padding: '0 10px' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
          Usuario Administrador (Dueño):
        </label>
        <input
          type="text"
          value={regUsername}
          onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder="ej. roberto_admin"
          required
          minLength={4}
          className="input-field"
          style={{ width: '100%', minHeight: '40px', padding: '0 10px', fontFamily: 'var(--font-mono)' }}
        />
      </div>

      {/* Toggle de recuperación: Correo o Teléfono */}
      <div>
        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '6px' }}>
          Dato de recuperación (obligatorio):
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
          <button
            type="button"
            onClick={() => { setRegRecoveryType('email'); setRegRecoveryValue(''); }}
            style={{
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${regRecoveryType === 'email' ? 'var(--primary)' : 'var(--border)'}`,
              background: regRecoveryType === 'email' ? 'var(--primary-light)' : 'var(--surface)',
              cursor: 'pointer',
              fontSize: '0.74rem',
              fontWeight: regRecoveryType === 'email' ? 700 : 500,
              color: 'var(--text-main)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              transition: 'all 0.16s ease',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            Correo
          </button>
          <button
            type="button"
            onClick={() => { setRegRecoveryType('phone'); setRegRecoveryValue(''); }}
            style={{
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${regRecoveryType === 'phone' ? 'var(--primary)' : 'var(--border)'}`,
              background: regRecoveryType === 'phone' ? 'var(--primary-light)' : 'var(--surface)',
              cursor: 'pointer',
              fontSize: '0.74rem',
              fontWeight: regRecoveryType === 'phone' ? 700 : 500,
              color: 'var(--text-main)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              transition: 'all 0.16s ease',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Teléfono
          </button>
        </div>
        <input
          type={regRecoveryType === 'email' ? 'email' : 'tel'}
          value={regRecoveryValue}
          onChange={(e) => setRegRecoveryValue(e.target.value)}
          placeholder={regRecoveryType === 'email' ? 'correo@ejemplo.com' : '7000-1122'}
          className="input-field"
          style={{ width: '100%', minHeight: '40px', padding: '0 10px' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
          PIN de acceso (4 a 6 dígitos):
        </label>
        <input
          type="password"
          inputMode="numeric"
          value={regPin}
          onChange={(e) => setRegPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Ej. 1234"
          required
          minLength={4}
          maxLength={6}
          className="input-field"
          style={{ width: '100%', minHeight: '40px', padding: '0 10px', fontFamily: 'var(--font-mono)' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
          Contraseña (mínimo 6 caracteres):
        </label>
        <input
          type="password"
          value={regPassword}
          onChange={(e) => setRegPassword(e.target.value)}
          placeholder="••••••••"
          required
          minLength={6}
          className="input-field"
          style={{ width: '100%', minHeight: '40px', padding: '0 10px' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-body)', marginBottom: '4px' }}>
          Confirmar Contraseña:
        </label>
        <input
          type="password"
          value={regConfirmPassword}
          onChange={(e) => setRegConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
          minLength={6}
          className="input-field"
          style={{ width: '100%', minHeight: '40px', padding: '0 10px' }}
        />
      </div>

      {regErrorMsg && (
        <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', color: '#7E3F27', fontSize: '0.78rem' }}>
          {regErrorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmittingReg}
        className="btn btn-primary"
        style={{ minHeight: '44px', width: '100%', fontWeight: 700 }}
      >
        {isSubmittingReg ? 'Creando Tienda...' : 'Crear Cuenta y Abrir Tienda'}
      </button>
    </form>
  );

  const activeContent =
    viewMode === 'register'
      ? registerContent
      : viewMode === 'changePassword' || isChangingPassword
      ? changePasswordContent
      : viewMode === 'otp'
      ? otpContent
      : viewMode === 'recover'
      ? recoverContent
      : loginContent;

  if (isEmbedded) {
    return activeContent;
  }

  return (
    <div className="dlg-overlay" role="dialog" aria-modal="true" aria-label="Inicio de sesión">
      <div className="dlg" style={{ maxWidth: '440px', width: '100%', margin: isMobileDevice ? '12px' : 'auto' }}>
        <div className="dlg-head" style={{ padding: isMobileDevice ? '12px 14px' : '14px 18px' }}>
          <div className="dlg-ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className="dlg-title" style={{ fontSize: isMobileDevice ? '0.92rem' : '1.02rem', wordBreak: 'break-word' }}>
            Acceso al Sistema Contable
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
            }}
            title="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="dlg-body" style={{ padding: isMobileDevice ? '14px' : '18px' }}>
          {activeContent}
        </div>
      </div>
    </div>
  );
}

export default LoginModal;