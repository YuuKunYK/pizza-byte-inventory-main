import { useState, useEffect } from 'react';
import { ClipboardList, Loader2, Filter, Search, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subDays } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/components/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Type definitions
interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  created_at: string;
  user_id: string;
  location_id: string;
  // Joined properties
  user?: {
    name: string;
    email: string;
  };
  location?: {
    name: string;
  };
}

interface Location {
  id: string;
  name: string;
}

type EntityType = 'inventory_items' | 'stock_requests' | 'stock_entries' | 'recipes' | 'profiles' | 'locations' | 'sales' | 'all';
type ActionType = 'create' | 'update' | 'delete' | 'fulfill' | 'reject' | 'dispatch' | 'all';

export default function ActivityLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date()
  });
  const [filters, setFilters] = useState({
    entity_type: 'all' as EntityType,
    action: 'all' as ActionType,
    location_id: 'all',
    search: '',
  });
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');

  useEffect(() => {
    fetchLocations();
    fetchLogs();
  }, []);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;
      setLocations(data || []);
    } catch (error: any) {
      console.error('Error fetching locations:', error);
      toast.error('Failed to load locations', {
        description: error.message || 'Please try again later'
      });
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Use a simpler query without joins first to see if that works
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.entity_type !== 'all') {
        query = query.eq('entity_type', filters.entity_type);
      }

      if (filters.action !== 'all') {
        query = query.eq('action', filters.action);
      }

      if (filters.location_id !== 'all') {
        query = query.eq('location_id', filters.location_id);
      }

      // Apply date range filters
      if (dateRange.from) {
        query = query.gte('created_at', format(dateRange.from, 'yyyy-MM-dd'));
      }
      
      if (dateRange.to) {
        // Add one day to include the end date
        const nextDay = new Date(dateRange.to);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt('created_at', format(nextDay, 'yyyy-MM-dd'));
      }

      // Search through details (JSON field)
      if (filters.search) {
        // This is a simplified approach - in reality, searching JSON is more complex
        query = query.or(`details.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch user and location data separately
      const logsWithDetails = await Promise.all((data || []).map(async (log) => {
        let userData = { name: 'Unknown User', email: 'unknown' };
        let locationData = { name: 'Unknown Location' };
        
        // Fetch user info if available
        if (log.user_id) {
          const { data: userInfo } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', log.user_id)
            .single();
            
          if (userInfo) {
            userData = userInfo;
          }
        }
        
        // Fetch location info if available
        if (log.location_id) {
          const { data: locationInfo } = await supabase
            .from('locations')
            .select('name')
            .eq('id', log.location_id)
            .single();
            
          if (locationInfo) {
            locationData = locationInfo;
          }
        }
        
        return {
          ...log,
          user: userData,
          location: locationData
        };
      }));
      
      // Cast as ActivityLog[] type
      setLogs(logsWithDetails as ActivityLog[]);
    } catch (error: any) {
      console.error('Error fetching activity logs:', error);
      toast.error('Failed to load activity logs', {
        description: error.message || 'Please try again later'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setIsFilterDialogOpen(false);
    fetchLogs();
  };

  const resetFilters = () => {
    setFilters({
      entity_type: 'all',
      action: 'all',
      location_id: 'all', 
      search: '',
    });
    setDateRange({
      from: subDays(new Date(), 7),
      to: new Date()
    });
    setIsFilterDialogOpen(false);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    if (value === 'all') {
      setFilters(prev => ({ ...prev, entity_type: 'all' }));
    } else {
      setFilters(prev => ({ ...prev, entity_type: value as EntityType }));
    }
    
    fetchLogs();
  };

  const formatLogDetails = (log: ActivityLog) => {
    try {
      if (!log.details) return 'No details available';
      
      const { before, after, reason, ...otherDetails } = log.details;

      // Format for different entity types
      switch (log.entity_type) {
        case 'inventory_items':
          if (log.action === 'create') {
            return `Created item "${after?.name}" with initial stock of ${after?.opening_stock || 0}`;
          } else if (log.action === 'update') {
            if (before && after) {
              const changes = [];
              
              if (before.name !== after.name) {
                changes.push(`name from "${before.name}" to "${after.name}"`);
              }
              
              if (before.cost_per_unit !== after.cost_per_unit) {
                changes.push(`cost from $${before.cost_per_unit} to $${after.cost_per_unit}`);
              }
              
              if (before.min_stock_threshold !== after.min_stock_threshold) {
                changes.push(`minimum stock from ${before.min_stock_threshold} to ${after.min_stock_threshold}`);
              }
              
              if (changes.length > 0) {
                return `Updated ${changes.join(', ')}`;
              }
              
              return 'Updated item properties';
            }
            return 'Updated item';
          } else if (log.action === 'delete') {
            return `Deleted item "${before?.name}"`;
          }
          break;
          
        case 'stock_requests':
          if (log.action === 'create') {
            return `Requested ${after?.requested_quantity} units of item from ${log.details?.from_location_name} to ${log.details?.to_location_name}`;
          } else if (log.action === 'update' || log.action === 'fulfill') {
            return `Fulfilled stock request with ${after?.dispatched_quantity} units`;
          } else if (log.action === 'reject') {
            return `Rejected stock request with reason: ${reason || 'No reason provided'}`;
          }
          break;
          
        case 'stock_entries':
          if (after?.closing_stock !== undefined && before?.closing_stock !== undefined) {
            const change = after.closing_stock - before.closing_stock;
            const changeType = change > 0 ? 'increased' : 'decreased';
            return `Stock ${changeType} by ${Math.abs(change)} units. Reason: ${reason || 'Not specified'}`;
          }
          return `Updated stock entry`;
          
        case 'profiles':
          if (log.action === 'create') {
            return `Created user "${after?.name}" with role ${after?.role}`;
          } else if (log.action === 'update') {
            const changes = [];
            if (before?.role !== after?.role) {
              changes.push(`role from "${before?.role}" to "${after?.role}"`);
            }
            if (before?.location_id !== after?.location_id) {
              changes.push(`location assignment`);
            }
            return `Updated user: ${changes.join(', ')}`;
          } else if (log.action === 'delete') {
            return `Deleted user "${before?.name}"`;
          }
          break;
          
        default:
          // For other entity types or when details structure is unknown
          return JSON.stringify(log.details);
      }
      
      // Fallback for unknown combinations
      return JSON.stringify(log.details);
    } catch (error) {
      console.error('Error formatting log details:', error);
      return 'Error displaying details';
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-green-500';
      case 'update':
        return 'bg-blue-500';
      case 'delete':
        return 'bg-red-500';
      case 'fulfill':
        return 'bg-green-600';
      case 'reject':
        return 'bg-amber-500';
      case 'dispatch':
        return 'bg-violet-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getEntityBadgeColor = (entityType: string) => {
    switch (entityType) {
      case 'inventory_items':
        return 'bg-emerald-500';
      case 'stock_requests':
        return 'bg-blue-600';
      case 'stock_entries':
        return 'bg-indigo-500';
      case 'recipes':
        return 'bg-pink-500';
      case 'profiles':
        return 'bg-amber-600';
      case 'locations':
        return 'bg-teal-500';
      case 'sales':
        return 'bg-purple-600';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Logs</h1>
          <p className="text-muted-foreground">
            View all system activities and changes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsFilterDialogOpen(true)}>
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full overflow-x-auto flex-wrap">
          <TabsTrigger value="all">All Activities</TabsTrigger>
          <TabsTrigger value="inventory_items">Inventory</TabsTrigger>
          <TabsTrigger value="stock_requests">Stock Requests</TabsTrigger>
          <TabsTrigger value="profiles">Users</TabsTrigger>
          <TabsTrigger value="recipes">Recipes</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <CardTitle>Activity Logs</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search in logs..."
                    className="pl-8"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                  />
                </div>
              </div>
              <CardDescription>
                {loading ? 'Loading logs...' : `Showing ${logs.length} activities`}
                {dateRange.from && dateRange.to && (
                  <> from {format(dateRange.from, 'PP')} to {format(dateRange.to, 'PP')}</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-lg font-medium">No activity logs found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Try adjusting your filters or check back later
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-36">Timestamp</TableHead>
                        <TableHead className="w-40">User</TableHead>
                        <TableHead className="w-32">Action</TableHead>
                        <TableHead className="w-32">Type</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="w-32">Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {log.created_at ? (
                              <>
                                <div>{format(new Date(log.created_at), 'dd MMM yyyy')}</div>
                                <div className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'hh:mm a')}</div>
                              </>
                            ) : (
                              'Unknown'
                            )}
                          </TableCell>
                          <TableCell>
                            {log.user ? (
                              <>
                                <div className="font-medium">{log.user.name}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[150px]">{log.user.email}</div>
                              </>
                            ) : (
                              'System'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("capitalize", getActionBadgeColor(log.action))}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("capitalize", getEntityBadgeColor(log.entity_type))}>
                              {log.entity_type.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="truncate">
                              {formatLogDetails(log)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.location ? log.location.name : 'System-wide'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Filter Dialog */}
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Filter Activity Logs</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-sm font-medium col-span-4">Date Range</label>
              <div className="col-span-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, 'PPP')} - {format(dateRange.to, 'PPP')}
                          </>
                        ) : (
                          format(dateRange.from, 'PPP')
                        )
                      ) : (
                        "Pick a date range"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={{
                        from: dateRange.from,
                        to: dateRange.to,
                      }}
                      onSelect={(range) => setDateRange({ 
                        from: range?.from || subDays(new Date(), 7), 
                        to: range?.to || new Date() 
                      })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-sm font-medium col-span-4">Entity Type</label>
              <div className="col-span-4">
                <Select 
                  value={filters.entity_type} 
                  onValueChange={(value) => handleFilterChange('entity_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="inventory_items">Inventory Items</SelectItem>
                    <SelectItem value="stock_requests">Stock Requests</SelectItem>
                    <SelectItem value="stock_entries">Stock Entries</SelectItem>
                    <SelectItem value="recipes">Recipes</SelectItem>
                    <SelectItem value="profiles">Users</SelectItem>
                    <SelectItem value="locations">Locations</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-sm font-medium col-span-4">Action</label>
              <div className="col-span-4">
                <Select 
                  value={filters.action} 
                  onValueChange={(value) => handleFilterChange('action', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select action type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                    <SelectItem value="fulfill">Fulfill</SelectItem>
                    <SelectItem value="reject">Reject</SelectItem>
                    <SelectItem value="dispatch">Dispatch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-sm font-medium col-span-4">Location</label>
              <div className="col-span-4">
                <Select 
                  value={filters.location_id} 
                  onValueChange={(value) => handleFilterChange('location_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={resetFilters}>
              Reset
            </Button>
            <Button onClick={applyFilters}>
              Apply Filters
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 