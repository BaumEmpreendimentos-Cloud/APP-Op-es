import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { strategyService } from '../services/strategyService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<boolean>;
  register: (name: string, email: string, pass: string) => Promise<boolean>;
  socialLogin: (provider: 'google' | 'apple', email?: string, name?: string) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  quickLogin: (account: 'trader1' | 'trader2') => Promise<boolean>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'b3_auth_token';
const USER_KEY = 'b3_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Synchronous hydration on mount for zero-latency session recovery
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check existing token on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUserRaw = localStorage.getItem(USER_KEY);

      if (!storedToken) {
        // First ever visit: default to trader1 so simulator features are never blocked
        await quickLogin('trader1');
        setIsLoading(false);
        return;
      }

      let localUser: User | null = null;
      if (storedUserRaw) {
        try {
          localUser = JSON.parse(storedUserRaw);
          if (localUser && localUser.id) {
            setUser(localUser);
          }
        } catch {
          // ignore
        }
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setUser(data.user);
            setToken(storedToken);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            // Automatically migrate any strategies saved before login
            strategyService.migrateGuestStrategiesToUser(storedToken, data.user.id);
          }
        } else {
          // If server reported token expired, but we have a user, preserve their session locally
          // NEVER force-switch a registered user (like Vinissios) to trader1!
          if (!localUser) {
            await quickLogin('trader1');
          }
        }
      } catch (err) {
        console.warn('Falha ao validar token com o servidor, mantendo perfil local ativo:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, pass: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        await strategyService.migrateGuestStrategiesToUser(data.token, data.user.id);
        setIsLoading(false);
        return true;
      } else {
        setError(data.error || 'Credenciais inválidas.');
        setIsLoading(false);
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão com o servidor.');
      setIsLoading(false);
      return false;
    }
  };

  const register = async (name: string, email: string, pass: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password: pass }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        await strategyService.migrateGuestStrategiesToUser(data.token, data.user.id);
        setIsLoading(false);
        return true;
      } else {
        setError(data.error || 'Não foi possível cadastrar a conta.');
        setIsLoading(false);
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar ao servidor.');
      setIsLoading(false);
      return false;
    }
  };

  const socialLogin = async (
    provider: 'google' | 'apple',
    customEmail?: string,
    customName?: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, email: customEmail, name: customName }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        await strategyService.migrateGuestStrategiesToUser(data.token, data.user.id);
        setIsLoading(false);
        return true;
      } else {
        setError(data.error || 'Não foi possível realizar o login social.');
        setIsLoading(false);
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar ao servidor.');
      setIsLoading(false);
      return false;
    }
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      setIsLoading(false);
      if (res.ok && data.success) {
        return { success: true, message: data.message };
      } else {
        const msg = data.error || 'Falha ao solicitar redefinição de senha.';
        setError(msg);
        return { success: false, message: msg };
      }
    } catch (err: any) {
      const msg = err.message || 'Erro de conexão com o servidor.';
      setError(msg);
      setIsLoading(false);
      return { success: false, message: msg };
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        // ignore logout errors
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
  };

  const quickLogin = async (account: 'trader1' | 'trader2'): Promise<boolean> => {
    const email = account === 'trader1' ? 'trader1@b3.com.br' : 'trader2@b3.com.br';
    return await login(email, 'senha123');
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        login,
        register,
        socialLogin,
        forgotPassword,
        logout,
        quickLogin,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
