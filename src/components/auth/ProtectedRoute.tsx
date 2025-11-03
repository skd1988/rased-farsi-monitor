import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useNewAuth } from '@/contexts/NewAuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredRole?: string | string[];
  fallbackPath?: string;
  showUnauthorized?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
  fallbackPath = '/login',
  showUnauthorized = false,
}) => {
  const { user, loading, hasPermission } = useNewAuth();
  const location = useLocation();

  console.log('[ProtectedRoute]', {
    loading,
    user: user?.email,
    role: user?.role,
    status: user?.status,
    requiredPermission,
    pathname: location.pathname
  });

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to={fallbackPath} state={{ returnUrl: location.pathname }} replace />;
  }

  // Check if user is suspended or inactive
  if (user.status === 'suspended') {
    return <Navigate to="/unauthorized" state={{ reason: 'suspended' }} replace />;
  }

  if (user.status === 'inactive') {
    return <Navigate to="/unauthorized" state={{ reason: 'inactive' }} replace />;
  }

  // Check required permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    if (showUnauthorized) {
      return (
        <Navigate 
          to="/unauthorized" 
          state={{ 
            requiredPermission,
            currentRole: user.role,
            attemptedPath: location.pathname
          }} 
          replace 
        />
      );
    }
    return <Navigate to="/dashboard" replace />;
  }

  // Check required role
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(user.role)) {
      if (showUnauthorized) {
        return (
          <Navigate 
            to="/unauthorized" 
            state={{ 
              requiredRole: roles,
              currentRole: user.role,
              attemptedPath: location.pathname
            }} 
            replace 
          />
        );
      }
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};