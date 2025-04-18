import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/auth';
import { toast } from '@/components/ui/sonner';
import { Loader2, RefreshCw } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [userRole, setUserRole] = useState<UserRole>(UserRole.BRANCH);
  const [isSignup, setIsSignup] = useState(false);
  const [locations, setLocations] = useState<{id: string, name: string}[]>([]);
  const { login, signup, isLoading } = useAuth();
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);

  // Function to create Ocean Mall location if it doesn't exist
  const createOceanMallLocation = async () => {
    setIsCreatingLocation(true);
    toast.info('Creating Ocean Mall location...');
    
    try {
      // First check if Ocean Mall already exists
      const { data: existingLocations, error: checkError } = await supabase
        .from('locations')
        .select('id')
        .eq('name', 'Ocean Mall');

      if (checkError) {
        console.error('Error checking for Ocean Mall:', checkError);
        toast.error(`Failed to check for Ocean Mall: ${checkError.message}`);
        setIsCreatingLocation(false);
        return;
      }

      if (existingLocations && existingLocations.length > 0) {
        console.log('Ocean Mall location already exists:', existingLocations);
        toast.info('Ocean Mall location already exists');
        setIsCreatingLocation(false);
        return;
      }

      // If not, create it
      console.log('Adding Ocean Mall to database...');
      
      // Create a new UUID for the location
      const locationId = crypto.randomUUID();
      
      const { data, error } = await supabase
        .from('locations')
        .insert([{
          id: locationId,
          name: 'Ocean Mall',
          type: 'branch',
          address: 'Ocean Mall, Karachi',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Error creating Ocean Mall location:', error);
        toast.error(`Failed to create Ocean Mall: ${error.message}`);
      } else {
        console.log('Ocean Mall location created successfully:', data);
        toast.success('Ocean Mall location created successfully');
      }
    } catch (err) {
      console.error('Unexpected error creating location:', err);
      toast.error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsCreatingLocation(false);
      // Refresh locations after attempting to create
      fetchLocations();
    }
  };

  const fetchLocations = async () => {
    try {
      console.log('Fetching locations...');
      const { data, error } = await supabase
        .from('locations')
        .select('id, name');

      if (error) {
        console.error('Error fetching locations:', error);
        toast.error(`Failed to fetch locations: ${error.message}`);
        return;
      }

      if (data) {
        console.log('Fetched locations:', data);
        setLocations(data);
        
        // Log success or empty state
        if (data.length === 0) {
          console.log('No locations found in database');
          toast.warning('No locations found in database');
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching locations:', err);
      toast.error(`Error fetching locations: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  useEffect(() => {
    fetchLocations();
    // We won't automatically create the location - we'll use the button instead
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignup) {
      console.log('Signing up with role:', userRole);
      await signup(email, password, name, locationId, userRole);
    } else {
      await login({ email, password });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>{isSignup ? 'Sign Up' : 'Login'}</span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchLocations}
              disabled={isCreatingLocation}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Debug info */}
          <div className="mb-4 p-2 bg-gray-900 rounded text-xs text-gray-300 max-h-32 overflow-auto">
            <p>Locations count: {locations.length}</p>
            <p>Locations: {JSON.stringify(locations.map(l => l.name))}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {isSignup && (
              <>
                <Input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">Select Location</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={createOceanMallLocation}
                      disabled={isCreatingLocation}
                    >
                      {isCreatingLocation ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> 
                          Creating...
                        </>
                      ) : (
                        <>Add Ocean Mall</>
                      )}
                    </Button>
                  </div>
                  <Select 
                    value={locationId} 
                    onValueChange={setLocationId}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.length > 0 ? (
                        locations.map(location => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>No locations available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Role</label>
                  <Select 
                    value={userRole} 
                    onValueChange={(value) => {
                      console.log('Setting role to:', value);
                      setUserRole(value as UserRole);
                    }}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                      <SelectItem value={UserRole.BRANCH}>Branch</SelectItem>
                      <SelectItem value={UserRole.WAREHOUSE}>Warehouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <Button type="submit" className="w-full" disabled={isLoading || isCreatingLocation}>
              {isSignup ? 'Sign Up' : 'Login'}
            </Button>
          </form>
          <div className="text-center mt-4">
            <Button 
              variant="link" 
              onClick={() => setIsSignup(!isSignup)}
            >
              {isSignup 
                ? 'Already have an account? Login' 
                : 'Need an account? Sign Up'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
