import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/auth';
import { Loader2 } from 'lucide-react';

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background">
    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
    <p className="text-lg text-muted-foreground">Loading application...</p>
  </div>
);

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const RoleGuard = ({ children, allowedRoles }: RoleGuardProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.role as UserRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
