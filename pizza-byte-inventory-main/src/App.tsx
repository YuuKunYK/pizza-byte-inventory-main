import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import StockRequests from "./pages/StockRequests";
import Recipes from "./pages/Recipes";
import ItemManagement from "./pages/ItemManagement";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import LocationsPage from "./pages/admin/locations";
import ManageUsersPage from "./pages/admin/users";
import ActivityLogsPage from "./pages/ActivityLogs";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Transfers from "./pages/Transfers";
import POSMain from "./pages/pos/POSMain";
import POSAnalytics from "./pages/pos/POSAnalytics";
import NewOrder from "./pages/pos/NewOrder";
import POSCategoriesPage from "./pages/admin/pos-categories";
import POSItemsPage from "./pages/admin/pos-items";
import POSDiscountsPage from "./pages/admin/pos-discounts";
import { useAuth } from "./hooks/useAuth";
import { Loader2 } from "lucide-react";
import React from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";
import { RoleGuard } from "./components/auth/RoleGuard";
import { UserRole } from "./types/auth";

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

const LoginRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <Layout>{children}</Layout>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <NotificationsProvider>
              <Routes>
                <Route
                  path="/login"
                  element={
                    <LoginRoute>
                      <Login />
                    </LoginRoute>
                  }
                />
                <Route
                  path="/"
                  element={
                    <RoleGuard>
                      <AppLayout>
                        <Dashboard />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route
                  path="/inventory"
                  element={
                    <RoleGuard>
                      <AppLayout>
                        <Inventory />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route
                  path="/requests"
                  element={
                    <RoleGuard>
                      <AppLayout>
                        <StockRequests />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route
                  path="/recipes"
                  element={
                    <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.BRANCH]}>
                      <AppLayout>
                        <Recipes />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route
                  path="/item-management"
                  element={
                    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                      <AppLayout>
                        <ItemManagement />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route
                  path="/admin/locations"
                  element={
                    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                      <AppLayout>
                        <LocationsPage />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                      <AppLayout>
                        <ManageUsersPage />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route path="/locations" element={<Navigate to="/admin/locations" replace />} />
                <Route path="/users" element={<Navigate to="/admin/users" replace />} />
                <Route
                  path="/logs"
                  element={
                    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                      <AppLayout>
                        <ActivityLogsPage />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RoleGuard>
                      <AppLayout>
                        <Settings />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route
                  path="/transfers"
                  element={
                    <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.BRANCH]}>
                      <AppLayout>
                        <Transfers />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route
                  path="/pos"
                  element={
                    <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.BRANCH]}>
                      <AppLayout>
                        <POSMain />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route
                  path="/pos/new-order"
                  element={
                    <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.BRANCH]}>
                      <NewOrder />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/pos/analytics"
                  element={
                    <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.BRANCH]}>
                      <AppLayout>
                        <POSAnalytics />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route
                  path="/admin/pos-categories"
                  element={
                    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                      <AppLayout>
                        <POSCategoriesPage />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route
                  path="/admin/pos-items"
                  element={
                    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                      <AppLayout>
                        <POSItemsPage />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route
                  path="/admin/pos-discounts"
                  element={
                    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                      <AppLayout>
                        <POSDiscountsPage />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route path="/sales" element={<Navigate to="/pos" replace />} />
                <Route
                  path="/reports"
                  element={
                    <RoleGuard>
                      <AppLayout>
                        <Reports />
                      </AppLayout>
                    </RoleGuard>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </NotificationsProvider>
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
