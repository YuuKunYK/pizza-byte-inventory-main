import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AuthState, LoginCredentials, User, UserRole } from '@/types/auth';
import { toast } from '@/components/ui/sonner';

interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  signup: (
    email: string,
    password: string,
    name: string,
    locationId: string,
    role?: UserRole
  ) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const mapProfile = (userId: string, email: string, profile: any, metadata: Record<string, any> = {}): User => {
  const role = (profile?.role || metadata.role) as UserRole | undefined;

  return {
    id: userId,
    email: profile?.email || email || '',
    name: profile?.name || metadata.name || email?.split('@')[0] || 'User',
    role: role || UserRole.BRANCH,
    locationId: profile?.location_id || metadata.location_id || undefined,
    locationName: profile?.locations?.name,
    createdAt: profile?.created_at || new Date().toISOString(),
    updatedAt: profile?.updated_at || new Date().toISOString(),
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const loadUser = useCallback(async (userId: string, email?: string, metadata: Record<string, any> = {}) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, locations(name)')
      .eq('id', userId)
      .maybeSingle();

    const user = mapProfile(userId, email || '', profile, metadata);
    setAuthState({
      user,
      isAuthenticated: true,
      isLoading: false,
    });
    return user;
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setAuthState({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const { id, email, user_metadata } = session.user;
      setTimeout(() => {
        void loadUser(id, email || '', user_metadata || {});
      }, 0);
    });

    const initialize = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.user) {
          setAuthState({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        await loadUser(session.user.id, session.user.email || '', session.user.user_metadata || {});
      } catch {
        setAuthState({ user: null, isAuthenticated: false, isLoading: false });
      }
    };

    void initialize();
    return () => subscription.unsubscribe();
  }, [loadUser]);

  const login = async ({ email, password }: LoginCredentials) => {
    setAuthState((prev) => ({ ...prev, isLoading: true }));
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      toast.error('Login Failed', { description: error?.message || 'Invalid credentials' });
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }

    await loadUser(data.user.id, data.user.email || '', data.user.user_metadata || {});
    toast.success('Login Successful');
    return true;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    toast.success('Logged out successfully');
    navigate('/login', { replace: true });
  };

  const signup = async (
    _email: string,
    _password: string,
    _name: string,
    _locationId: string,
    _role: UserRole = UserRole.BRANCH
  ) => {
    toast.error('Signup is disabled', {
      description: 'Ask an administrator to create your account.',
    });
    return false;
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout, signup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthRedirect({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return <>{children}</>;
}
