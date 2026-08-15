import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/auth';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { toast } from '@/hooks/use-toast';

const Settings = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;
  const { settings, saveSettings, isSaving } = useBusinessSettings();
  const [restaurantName, setRestaurantName] = useState(settings.restaurantName);
  const [taxPercent, setTaxPercent] = useState(String(settings.taxRate * 100));
  const [timezone, setTimezone] = useState(settings.timezone);

  useEffect(() => {
    setRestaurantName(settings.restaurantName);
    setTaxPercent(String(settings.taxRate * 100));
    setTimezone(settings.timezone);
  }, [settings]);

  const handleSave = async () => {
    await saveSettings({
      ...settings,
      restaurantName,
      taxRate: Math.max(0, Number(taxPercent) || 0) / 100,
      timezone,
    });
    toast({
      title: 'Settings saved',
      description: 'Tax rate applies to new POS orders on this device.',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Business profile used on receipts, tax, and reports.</p>
      </div>

      <Tabs defaultValue="business" className="space-y-4">
        <TabsList>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle>Store profile</CardTitle>
              <CardDescription>
                {isAdmin
                  ? 'These values are used on POS receipts and tax calculations.'
                  : 'Ask an administrator to change tax and legal name.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Restaurant name</Label>
                <Input
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label>Sales tax (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={!isAdmin} />
              </div>
              {isAdmin && (
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save changes'}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Your account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Name:</span> {user?.name}
              </p>
              <p>
                <span className="text-muted-foreground">Email:</span> {user?.email}
              </p>
              <p>
                <span className="text-muted-foreground">Role:</span> {user?.role}
              </p>
              <p>
                <span className="text-muted-foreground">Location:</span>{' '}
                {user?.locationName || user?.locationId || 'Not assigned'}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
