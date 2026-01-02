import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: string;
}

interface AuthProvider {
  id: string;
  name: string;
  icon: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authDisabled: boolean;
  isSuperAdmin: boolean;
  providers: AuthProvider[];
  login: (provider: string) => void;
  logout: () => Promise<void>;
  handleCallback: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Use current origin in production (Docker), fallback to port 3001 for development
const API_URL = import.meta.env.VITE_API_URL ?? (window.location.port === '5173' ? `http://${window.location.hostname}:3001` : '');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [authDisabled, setAuthDisabled] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [providers, setProviders] = useState<AuthProvider[]>([]);

  // Fetch available providers and auth status
  useEffect(() => {
    fetch(`${API_URL}/auth/providers`)
      .then(res => res.json())
      .then(data => {
        setProviders(data.providers || []);
        setAuthDisabled(data.disabled || false);
      })
      .catch(console.error);
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/user`, {
          headers: token ? {
            'Authorization': `Bearer ${token}`,
          } : {},
          credentials: 'include',
        });
        const data = await res.json();

        // If auth is disabled, use the anonymous user
        if (data.authDisabled) {
          setAuthDisabled(true);
          setUser(data.user);
          setIsSuperAdmin(data.isSuperAdmin || false);
          setIsLoading(false);
          return;
        }

        if (data.user) {
          setUser(data.user);
          setIsSuperAdmin(data.isSuperAdmin || false);
        } else if (token) {
          // Token invalid, clear it
          localStorage.removeItem('auth_token');
          setToken(null);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        if (token) {
          localStorage.removeItem('auth_token');
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [token]);

  const login = (provider: string) => {
    window.location.href = `${API_URL}/auth/${provider}`;
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    setIsSuperAdmin(false);
  };

  const handleCallback = (newToken: string) => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        authDisabled,
        isSuperAdmin,
        providers,
        login,
        logout,
        handleCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
