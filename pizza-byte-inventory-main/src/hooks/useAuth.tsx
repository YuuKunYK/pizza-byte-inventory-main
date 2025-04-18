import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, AuthState, LoginCredentials, UserRole } from '@/types/auth';
import { toast } from '@/components/ui/sonner';

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true
  });
  const navigate = useNavigate();

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      // First attempt - try to get the profile from the database
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, locations(name)')
        .eq('id', userId)
        .single();

      // If there's an error or no profile data, create a fallback from session
      if (profileError || !profileData) {
        console.error('Error or missing profile data:', profileError || 'No profile data returned');
        console.log('Creating fallback user from session...');
        
        // Get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
        if (sessionError || !session?.user) {
          console.error('Error getting session or no session user:', sessionError || 'No session user');
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false
          });
          return null;
        }
          
        // Log the user metadata for debugging
        console.log('Session user:', session.user);
        const metadata = session.user.user_metadata || {};
        console.log('User metadata:', metadata);
          
        // Create a fallback user from session data
        const fallbackUser: User = {
          id: userId,
          email: session.user.email || '',
          name: metadata.name || session.user.email?.split('@')[0] || 'User',
          role: (metadata.role as UserRole) || UserRole.ADMIN,
          locationId: metadata.location_id || null,
          locationName: 'Unknown Location',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
          
        console.log('Created fallback user:', fallbackUser);
          
        // Set auth state with fallback user
        setAuthState({
          user: fallbackUser,
          isAuthenticated: true,
          isLoading: false
        });
          
        return fallbackUser;
      }

      // If profile data exists, create user from it
      const userProfile: User = {
        id: userId,
        email: profileData.email || '',
        name: profileData.name,
        role: profileData.role as UserRole,
        locationId: profileData.location_id,
        locationName: profileData.locations?.name,
        createdAt: profileData.created_at,
        updatedAt: profileData.updated_at
      };

      setAuthState({
        user: userProfile,
        isAuthenticated: true,
        isLoading: false
      });

      return userProfile;
    } catch (error) {
      console.error('Unexpected error in fetchUserProfile:', error);
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
      return null;
    }
  }, []);

  useEffect(() => {
    // Set up auth state change listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // IMMEDIATELY set authenticated state with basic user info
        console.log('User signed in, creating basic user from session');
        
        const metadata = session.user.user_metadata || {};
        const basicUser: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: metadata.name || session.user.email?.split('@')[0] || 'User',
          role: (metadata.role as UserRole) || UserRole.ADMIN,
          locationId: metadata.location_id || null,
          locationName: 'Unknown Location',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Set auth state immediately
        setAuthState({
          user: basicUser,
          isAuthenticated: true,
          isLoading: false
        });
        
        console.log('Auth state updated, user is now authenticated:', basicUser);
        
        // REMOVE REDIRECT FROM HERE - login function will handle it
        // The direct navigation here was causing a redirect loop
      } else if (event === 'SIGNED_OUT') {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false
        });
      }
    });

    // Check for current session on mount
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false
          });
          return;
        }

        if (session?.user) {
          // User is already logged in - set state immediately
          console.log('Found existing session, setting authenticated state');
          
          const metadata = session.user.user_metadata || {};
          const basicUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: metadata.name || session.user.email?.split('@')[0] || 'User',
            role: (metadata.role as UserRole) || UserRole.ADMIN,
            locationId: metadata.location_id || null,
            locationName: 'Unknown Location',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          setAuthState({
            user: basicUser,
            isAuthenticated: true,
            isLoading: false
          });
          
          console.log('User authenticated from session:', basicUser);
        } else {
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      } catch (error) {
        console.error('Unexpected error in initializeAuth:', error);
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false
        });
      }
    };

    // Initialize auth and set a safety timeout to prevent infinite loading
    initializeAuth();
    
    // Safety timeout - force end loading state after 5 seconds no matter what
    const safetyTimeout = setTimeout(() => {
      setAuthState(prev => {
        if (prev.isLoading) {
          console.log('Safety timeout triggered - forcing end of loading state');
          // If we're still loading after 5 seconds, force it to end
          return { ...prev, isLoading: false };
        }
        return prev;
      });
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, [fetchUserProfile, navigate]);

  const login = async ({ email, password }: LoginCredentials) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    try {
      console.log('Attempting login for:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error("Login error:", error);
        toast.error('Login Failed', {
          description: error.message
        });
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      if (data.user) {
        console.log('Login successful! Redirecting immediately...');
        
        // Set auth state to authenticated immediately
        setAuthState({
          // Use minimal user data directly from auth response
          user: {
            id: data.user.id,
            email: data.user.email || '',
            name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
            role: (data.user.user_metadata?.role as UserRole) || UserRole.ADMIN,
            locationId: data.user.user_metadata?.location_id || null,
            locationName: 'Unknown Location',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          isAuthenticated: true,
          isLoading: false
        });
        
        toast.success('Login Successful');
        
        // DIRECT BROWSER REDIRECT - most reliable method
        console.log('Forcing browser redirect to dashboard...');
        
        // Use setTimeout to ensure the redirect happens after state update
        setTimeout(() => {
          window.location.href = '/';
        }, 100);
        
        return true;
      }

      setAuthState(prev => ({ ...prev, isLoading: false }));
      return false;
    } catch (error) {
      console.error('Unexpected error during login:', error);
      toast.error('Login Failed', {
        description: 'An unexpected error occurred'
      });
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const logout = async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    try {
      await supabase.auth.signOut();
      // The auth state change listener will handle updating state
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      toast.error('Logout Failed', {
        description: 'An unexpected error occurred'
      });
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const signup = async (email: string, password: string, name: string, locationId: string, role: UserRole = UserRole.BRANCH) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      // First, create the auth user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            location_id: locationId,
            role
          }
        }
      });

      if (error) {
        console.error("Signup error:", error);
        toast.error('Signup Failed', {
          description: error.message
        });
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      // Check if user was created
      if (!data.user) {
        toast.error('Signup Failed', {
          description: 'User could not be created'
        });
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      // Now, manually create the profile to ensure it's created correctly
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          name: name,
          email: email,
          role: role,
          location_id: locationId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        // Continue with signup but log the error
      }

      // Show success message
      toast.success('Signup Successful', {
        description: 'You can now log in with your credentials'
      });
      
      // Navigate to login page after signup
      navigate('/login');
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return true;
    } catch (error) {
      console.error('Unexpected error during signup:', error);
      toast.error('Signup Failed', {
        description: 'An unexpected error occurred'
      });
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  return {
    ...authState,
    login,
    logout,
    signup
  };
};
