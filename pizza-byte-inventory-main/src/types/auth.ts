import { User as SupabaseUser } from '@supabase/supabase-js';

export enum UserRole {
  ADMIN = 'admin',
  BRANCH = 'branch',
  WAREHOUSE = 'warehouse'
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  role: UserRole | string;
  locationId?: string;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  type: 'branch' | 'warehouse';
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
