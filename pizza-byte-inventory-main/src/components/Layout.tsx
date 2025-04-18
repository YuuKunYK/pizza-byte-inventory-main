import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  FileSpreadsheet,
  Home,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  X,
  Tags,
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/auth';

interface SidebarItemProps {
  icon: React.ElementType;
  text: string;
  to: string;
  active?: boolean;
}

const SidebarItem = ({ icon: Icon, text, to, active }: SidebarItemProps) => (
  <Link
    to={to}
    className={cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all',
      active
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-secondary hover:text-primary'
    )}
  >
    <Icon className="h-5 w-5" />
    <span>{text}</span>
  </Link>
);

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const location = useLocation();
  const { user, logout } = useAuth();

  // Function to check if a path is active
  const isActive = (path: string) => location.pathname === path;

  // Admin-only menu items
  const adminMenuItems = [
    { icon: Users, text: 'Manage Users', to: '/users' },
    { icon: MapPin, text: 'Locations', to: '/locations' },
    { icon: Settings, text: 'System Settings', to: '/settings' },
  ];

  // Common menu items for all roles
  const commonMenuItems = [
    { icon: Home, text: 'Dashboard', to: '/' },
    { icon: Package, text: 'Inventory', to: '/inventory' },
    { icon: Tags, text: 'Item Management', to: '/item-management' },
    { icon: ShoppingCart, text: 'Stock Requests', to: '/requests' },
    { icon: Truck, text: 'Stock Transfers', to: '/transfers' },
    { icon: ChefHat, text: 'Recipes', to: '/recipes' },
    { icon: FileSpreadsheet, text: 'Sales Entry', to: '/sales' },
    { icon: BarChart3, text: 'Reports', to: '/reports' },
    { icon: ClipboardList, text: 'Activity Logs', to: '/logs' },
  ];

  // Filter menu items based on user role
  const menuItems = [
    ...commonMenuItems,
    ...(user?.role === UserRole.ADMIN || user?.role?.toString() === UserRole.ADMIN ? adminMenuItems : []),
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 z-50 flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        {/* Sidebar header with logo */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          {sidebarOpen ? (
            <Link to="/" className="flex items-center gap-2">
              <img 
                src="/nyp-logo.png" 
                alt="NYP Logo" 
                className="h-8 w-auto"
              />
              <span className="font-bold">NYP Inventory</span>
            </Link>
          ) : (
            <Link to="/" className="flex items-center justify-center">
              <img 
                src="/nyp-logo.png" 
                alt="NYP Logo" 
                className="h-8 w-auto"
              />
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 w-8"
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>

        {/* Sidebar content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
          <nav className="flex flex-col gap-1">
            {menuItems.map((item) => (
              <SidebarItem
                key={item.to}
                icon={item.icon}
                text={item.text}
                to={item.to}
                active={isActive(item.to)}
              />
            ))}
          </nav>
        </div>

        {/* User info */}
        {user && (
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full',
                  user.role === UserRole.ADMIN.toString()
                    ? 'bg-admin'
                    : user.role === UserRole.WAREHOUSE.toString()
                    ? 'bg-warehouse'
                    : 'bg-branch'
                )}
              >
                <span className="text-sm font-semibold text-white">
                  {user.name.charAt(0)}
                </span>
              </div>
              {sidebarOpen && (
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.role} {user.locationId ? '•' : ''} {user.locationId ? 'Location ID: ' + user.locationId.substring(0, 8) : ''}
                  </p>
                </div>
              )}
              {sidebarOpen && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main
        className={cn(
          'flex-1 transition-all duration-300 ease-in-out',
          sidebarOpen ? 'ml-64' : 'ml-16'
        )}
      >
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
