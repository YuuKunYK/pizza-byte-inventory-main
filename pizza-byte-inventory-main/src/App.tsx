import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import StockRequests from "./pages/StockRequests";
import Recipes from "./pages/Recipes";
import ItemManagement from "./pages/ItemManagement";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import LocationsPage from "./pages/admin/locations";
import ActivityLogsPage from "./pages/ActivityLogs";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import SalesEntry from "./pages/SalesEntry";
import { useAuth } from "./hooks/useAuth";
import { Loader2 } from "lucide-react";
import React from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background">
    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
    <p className="text-lg text-muted-foreground">Loading application...</p>
  </div>
);

// Direct Home Page component that doesn't use PrivateRoute
// This ensures that direct navigation from NotFound works properly
const HomePage = () => {
  const { isAuthenticated, isLoading } = useAuth();
  
  console.log('HomePage direct access:', { isAuthenticated, isLoading });

  if (isLoading) {
    return <LoadingScreen />;
  }
  
  if (!isAuthenticated) {
    console.log('HomePage: Not authenticated, redirecting to login');
    window.location.href = '/login';
    return <LoadingScreen />;
  }
  
  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
};

// Simple LoginRoute that redirects to home if already authenticated
const LoginRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  console.log('LoginRoute check:', { isAuthenticated, isLoading });

  // Check if already authenticated and force redirect to home
  React.useEffect(() => {
    if (!isLoading && isAuthenticated) {
      console.log('Already authenticated, forcing direct redirect to home');
      window.location.href = '/';
    }
  }, [isLoading, isAuthenticated]);

  // Show loading state
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Only render login if not authenticated
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // Show loading while redirect happens
  return <LoadingScreen />;
};

// Define the PrivateRoute component inside the app to access useAuth
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  console.log('PrivateRoute check:', { 
    isAuthenticated, 
    isLoading, 
    hasUser: !!user,
    userDetails: user 
  });

  // Show loading state
  if (isLoading) {
    console.log('PrivateRoute: Still loading...');
    return <LoadingScreen />;
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    console.log('PrivateRoute: User is NOT authenticated - redirecting to login');
    // Use direct browser navigation as a more reliable approach
    window.location.href = '/login';
    return <LoadingScreen />;
  }

  // Log authentication success
  console.log('PrivateRoute: User is authenticated - rendering content');
  
  // Allow rendering of children if authenticated
  return <>{children}</>;
};

// Root component that checks auth state on initial load
const AuthWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  return <>{children}</>;
};

// Wrap the app with BrowserRouter
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <NotificationsProvider>
              <AuthWrapper>
                <Routes>
                  <Route 
                    path="/login" 
                    element={
                      <LoginRoute>
                        <Login />
                      </LoginRoute>
                    } 
                  />
                  {/* Direct access to home page */}
                  <Route
                    path="/"
                    element={<HomePage />}
                  />
                  <Route
                    path="/inventory"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <Inventory />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/requests"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <StockRequests />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/recipes"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <Recipes />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/item-management"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <ItemManagement />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/locations"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <LocationsPage />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/users"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <Dashboard />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/logs"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <ActivityLogsPage />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <Settings />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  {/* Additional routes */}
                  <Route
                    path="/transfers"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <Dashboard />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/sales"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <SalesEntry />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <Reports />
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                  {/* Catch-all route for 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AuthWrapper>
            </NotificationsProvider>
          </TooltipProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
