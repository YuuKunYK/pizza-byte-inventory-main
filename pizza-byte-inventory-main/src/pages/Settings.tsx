import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/auth';

const Settings = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;

  const handleSaveGeneral = () => {
    toast({
      title: "Settings saved",
      description: "Your general settings have been saved successfully.",
    });
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Notification settings saved",
      description: "Your notification preferences have been updated.",
    });
  };

  const handleSaveAppearance = () => {
    toast({
      title: "Appearance settings saved",
      description: "Your appearance settings have been updated.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your system settings and preferences.
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          {isAdmin && <TabsTrigger value="system">System</TabsTrigger>}
        </TabsList>
        
        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure basic settings for your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select defaultValue="America/New_York">
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="defaultLocation">Default Location</Label>
                <Select defaultValue={user?.locationId || "default-location"}>
                  <SelectTrigger id="defaultLocation">
                    <SelectValue placeholder="Select default location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={user?.locationId || "default-location"}>Current Location</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5">
                  <Label htmlFor="autoLogout" className="cursor-pointer">Automatic Logout</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically log out after 30 minutes of inactivity
                  </p>
                </div>
                <Switch id="autoLogout" defaultChecked />
              </div>
              
              <Button onClick={handleSaveGeneral} className="mt-4">Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure when and how you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="lowStockAlerts" className="cursor-pointer">Low Stock Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications when items are running low
                  </p>
                </div>
                <Switch id="lowStockAlerts" defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="requestUpdates" className="cursor-pointer">Stock Request Updates</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about stock request status changes
                  </p>
                </div>
                <Switch id="requestUpdates" defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="systemNotifications" className="cursor-pointer">System Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive important system updates and announcements
                  </p>
                </div>
                <Switch id="systemNotifications" defaultChecked />
              </div>
              
              <Button onClick={handleSaveNotifications} className="mt-4">Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Appearance Settings */}
        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize the look and feel of your interface
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select defaultValue="system">
                  <SelectTrigger id="theme">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System Default</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="compactView" className="cursor-pointer">Compact View</Label>
                  <p className="text-sm text-muted-foreground">
                    Display more content with reduced spacing
                  </p>
                </div>
                <Switch id="compactView" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fontSize">Font Size</Label>
                <Select defaultValue="medium">
                  <SelectTrigger id="fontSize">
                    <SelectValue placeholder="Select font size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={handleSaveAppearance} className="mt-4">Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* System Settings (Admin Only) */}
        {isAdmin && (
          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>
                  Advanced settings for system configuration (Admin only)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="backupSchedule">Backup Schedule</Label>
                  <Select defaultValue="daily">
                    <SelectTrigger id="backupSchedule">
                      <SelectValue placeholder="Select backup frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lowStockThreshold">Default Low Stock Threshold (%)</Label>
                  <Input id="lowStockThreshold" type="number" defaultValue={20} min={1} max={50} />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="maintenanceMode" className="cursor-pointer">Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Put the system in maintenance mode (all users will be logged out)
                    </p>
                  </div>
                  <Switch id="maintenanceMode" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="apiEndpoint">API Endpoint</Label>
                  <Input id="apiEndpoint" defaultValue="https://api.pizzabyte.com/v1" />
                </div>
                
                <Button onClick={() => toast({
                  title: "System settings saved",
                  description: "System configuration has been updated successfully.",
                })} className="mt-4">Save Configuration</Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Settings; 