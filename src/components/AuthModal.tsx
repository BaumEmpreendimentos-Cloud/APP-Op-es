import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  ArrowLeft,
  X,
  AlertCircle,
  LogOut,
  CheckCircle2,
  KeyRound,
  ExternalLink,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (name: string) => void;
}

interface GoogleAccountOption {
  name: string;
  email: string;
  avatarColor: string;
  isDefault?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const { user, login, register, socialLogin, forgotPassword, logout, error, clearError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'google-choose-account' | 'forgot-password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState<string | null>(null);

  // Custom Google account input state
  const [showOtherGoogleInput, setShowOtherGoogleInput] = useState(false);
  const [otherGoogleEmail, setOtherGoogleEmail] = useState('');
  const [otherGoogleName, setOtherGoogleName] = useState('');

  // Default known Google accounts list
  const googleAccounts: GoogleAccountOption[] = [
    {
      name: 'Vinissios Baum',
      email: 'vinissiosbaum12@gmail.com',
      avatarColor: 'from-blue-600 to-indigo-600',
      isDefault: true,
    },
    {
      name: 'Operador Trader B3',
      email: 'trader.b3opcoes@gmail.com',
      avatarColor: 'from-emerald-600 to-teal-600',
    },
  ];

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const ok = await login(email, password);
        if (ok) {
          onLoginSuccess?.(email);
          onClose();
        }
      } else if (mode === 'register') {
        if (!name.trim()) {
          setLocalError('Por favor, informe seu nome.');
          setIsSubmitting(false);
          return;
        }
        const ok = await register(name, email, password);
        if (ok) {
          onLoginSuccess?.(name);
          onClose();
        }
      }
    } catch (err: any) {
      setLocalError(err.message || 'Erro inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectGoogleAccount = async (accountEmail: string, accountName: string) => {
    setIsSubmitting(true);
    setLocalError(null);
    clearError();
    try {
      const ok = await socialLogin('google', accountEmail, accountName);
      if (ok) {
        onLoginSuccess?.(accountName);
        onClose();
      }
    } catch (err: any) {
      setLocalError(err.message || 'Falha ao autenticar com o Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otherGoogleEmail.trim() || !otherGoogleEmail.includes('@')) {
      setLocalError('Por favor, insira um e-mail do Google válido.');
      return;
    }
    const derivedName = otherGoogleName.trim() || otherGoogleEmail.split('@')[0];
    await handleSelectGoogleAccount(otherGoogleEmail.trim().toLowerCase(), derivedName);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    setForgotSuccessMessage(null);

    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setLocalError('Por favor, informe um e-mail válido.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await forgotPassword(forgotEmail.trim());
      if (res.success) {
        setForgotSuccessMessage(res.message);
      } else {
        setLocalError(res.message || 'Não foi possível processar a recuperação.');
      }
    } catch (err: any) {
      setLocalError(err.message || 'Erro ao conectar ao servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenExternalGoogleChooser = () => {
    // Open Google's official account chooser in a new tab
    const redirectUrl = window.location.href;
    const googleChooserUrl = `https://accounts.google.com/AccountChooser?service=lso&continue=${encodeURIComponent(
      redirectUrl
    )}`;
    window.open(googleChooserUrl, '_blank', 'width=500,height=600');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2 sm:gap-2.5">
            {mode !== 'login' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setLocalError(null);
                  clearError();
                  setShowOtherGoogleInput(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Voltar"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                {mode === 'google-choose-account'
                  ? 'Fazer login com o Google'
                  : mode === 'forgot-password'
                  ? 'Recuperação de Senha'
                  : mode === 'login'
                  ? 'Entrar na Plataforma'
                  : 'Criar Conta'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                {mode === 'google-choose-account'
                  ? 'Escolha uma conta para continuar em Opções B3'
                  : mode === 'forgot-password'
                  ? 'Informe seu e-mail para receber as instruções'
                  : mode === 'login'
                  ? 'Acesse para gerenciar suas estratégias e simulações'
                  : 'Cadastre-se para salvar suas operações'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Current User Card if Logged in */}
          {user && mode !== 'google-choose-account' && (
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-300">{user.name}</span>
                      <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[10px] rounded font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Conectado
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block">{user.email}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-300 text-xs font-medium transition cursor-pointer border border-slate-700/60"
                  title="Sair desta conta"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW: GOOGLE ACCOUNT CHOOSER ("Escolha uma conta") */}
          {mode === 'google-choose-account' ? (
            <div className="space-y-4 animate-fadeIn">
              {/* Google Brand Header */}
              <div className="flex flex-col items-center text-center space-y-2 pb-2 border-b border-slate-800/80">
                <svg className="w-8 h-8" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <div>
                  <h4 className="text-sm font-bold text-white">Escolha uma conta</h4>
                  <p className="text-xs text-slate-400">
                    para acessar <strong className="text-slate-200">Opções B3 Pro</strong>
                  </p>
                </div>
              </div>

              {(error || localError) && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error || localError}</span>
                </div>
              )}

              {/* Accounts List */}
              <div className="space-y-2">
                {googleAccounts.map((acc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectGoogleAccount(acc.email, acc.name)}
                    disabled={isSubmitting}
                    className="w-full p-3 rounded-2xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-blue-500/50 transition flex items-center justify-between text-left cursor-pointer group shadow-sm disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full bg-gradient-to-tr ${acc.avatarColor} flex items-center justify-center text-white font-black text-sm shadow`}
                      >
                        {acc.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white group-hover:text-blue-400 transition">
                            {acc.name}
                          </span>
                          {acc.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              Principal
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block font-mono">{acc.email}</span>
                      </div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition" />
                  </button>
                ))}

                {/* Option: Usar outra conta */}
                {!showOtherGoogleInput ? (
                  <button
                    type="button"
                    onClick={() => setShowOtherGoogleInput(true)}
                    className="w-full p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-800/70 border border-dashed border-slate-700 hover:border-slate-500 transition flex items-center gap-3 text-left cursor-pointer text-xs font-semibold text-slate-300"
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Usar outra conta do Google</span>
                      <span className="text-[11px] text-slate-400">Entrar com outro e-mail do Gmail</span>
                    </div>
                  </button>
                ) : (
                  <form
                    onSubmit={handleCustomGoogleSubmit}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-blue-500/40 space-y-3 animate-fadeIn"
                  >
                    <span className="text-xs font-bold text-white block">Informe sua conta Google:</span>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Nome (opcional)"
                        value={otherGoogleName}
                        onChange={(e) => setOtherGoogleName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="email"
                        required
                        placeholder="seu.email@gmail.com"
                        value={otherGoogleEmail}
                        onChange={(e) => setOtherGoogleEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowOtherGoogleInput(false)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting ? 'Acessando...' : 'Conectar com esta conta'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Privacy Notice & Security Disclaimer */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Segurança e Privacidade Google</span>
                </div>
                <p className="leading-relaxed">
                  Para continuar, o Google compartilhará seu nome e endereço de e-mail com segurança para autenticar sua conta no Opções B3.
                </p>
                <button
                  type="button"
                  onClick={handleOpenExternalGoogleChooser}
                  className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 mt-1 cursor-pointer underline underline-offset-2"
                >
                  <span>Abrir seletor oficial de contas Google em nova janela</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {/* Back to main login */}
              <div className="pt-2 text-center border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setLocalError(null);
                    clearError();
                  }}
                  className="text-xs text-slate-400 hover:text-white font-medium transition cursor-pointer"
                >
                  Voltar para o login com e-mail e senha
                </button>
              </div>
            </div>
          ) : mode === 'forgot-password' ? (
            /* VIEW: FORGOT PASSWORD ("Esqueci a Senha") */
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-800/80">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Redefinição de Acesso
                </span>
              </div>

              {(error || localError) && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error || localError}</span>
                </div>
              )}

              {forgotSuccessMessage ? (
                <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 space-y-3 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Instruções Enviadas!</h4>
                    <p className="text-[11px] text-emerald-300/90 mt-1 leading-relaxed">
                      {forgotSuccessMessage}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setForgotSuccessMessage(null);
                      setLocalError(null);
                      clearError();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Voltar para o Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Informe o e-mail cadastrado na sua conta. Enviaremos um link seguro para você redefinir sua senha.
                  </p>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 block">E-mail Cadastrado</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        placeholder="seu@email.com"
                        value={forgotEmail || email}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 mt-1"
                  >
                    <span>{isSubmitting ? 'Enviando...' : 'Enviar Instruções de Redefinição'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              <div className="pt-2 text-center border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setLocalError(null);
                    clearError();
                  }}
                  className="text-xs text-slate-400 hover:text-white font-medium transition cursor-pointer"
                >
                  Lembrou sua senha? Faça login
                </button>
              </div>
            </div>
          ) : (
            /* VIEW: STANDARD LOGIN / REGISTER */
            <>
              {/* Google Button - Opens Google Account Chooser */}
              <div className="space-y-2">
                <button
                  type="button"
                  id="btn-login-google"
                  onClick={() => {
                    setMode('google-choose-account');
                    setLocalError(null);
                    clearError();
                  }}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-100 border border-slate-700 hover:border-blue-500/60 text-xs font-semibold transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 shadow-sm group"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Entrar com o Google (Escolher conta)</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-400 uppercase tracking-wider">
                  ou com email e senha
                </span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {(error || localError) && (
                  <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error || localError}</span>
                  </div>
                )}

                {mode === 'register' && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 block">Nome Completo</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        placeholder="Seu nome"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">E-mail</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 block">Senha</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        id="btn-forgot-password"
                        onClick={() => {
                          setMode('forgot-password');
                          setForgotEmail(email);
                          setLocalError(null);
                          clearError();
                          setForgotSuccessMessage(null);
                        }}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer hover:underline transition"
                      >
                        Esqueci a senha
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 mt-1"
                >
                  <span>
                    {isSubmitting ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>

              {/* Toggle Login / Register */}
              <div className="pt-2 text-center border-t border-slate-800/80">
                {mode === 'login' ? (
                  <p className="text-xs text-slate-400">
                    Não tem uma conta?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        clearError();
                        setLocalError(null);
                      }}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 transition cursor-pointer"
                    >
                      Cadastre-se
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">
                    Já possui uma conta?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        clearError();
                        setLocalError(null);
                      }}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 transition cursor-pointer"
                    >
                      Fazer Login
                    </button>
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
