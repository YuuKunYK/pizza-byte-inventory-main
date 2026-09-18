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
import { ENTITY_LABELS, ENTITY_TYPES, EntityType as LogEntityType } from '@/lib/activity-logger';
import { formatCurrency } from '@/types/pos';

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
  } | null;
  location?: {
    name: string;
  } | null;
}

interface Location {
  id: string;
  name: string;
}

type EntityType = LogEntityType | 'all';
type ActionType = string;

const ACTION_OPTIONS = [
  'create',
  'update',
  'delete',
  'fulfill',
  'reject',
  'dispatch',
  'created',
  'updated',
  'deleted',
  'order_created',
  'order_status_changed',
  'order_cancelled',
  'stock_adjusted',
  'stock_transferred',
  'request_fulfilled',
  'request_partially_fulfilled',
];

const PAGE_SIZE = 200;

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
      const applyFilters = (query: any) => {
        if (filters.entity_type !== 'all') query = query.eq('entity_type', filters.entity_type);
        if (filters.action !== 'all') query = query.eq('action', filters.action);
        if (filters.location_id !== 'all') query = query.eq('location_id', filters.location_id);
        if (dateRange.from) query = query.gte('created_at', format(dateRange.from, 'yyyy-MM-dd'));
        if (dateRange.to) {
          const nextDay = new Date(dateRange.to);
          nextDay.setDate(nextDay.getDate() + 1);
          query = query.lt('created_at', format(nextDay, 'yyyy-MM-dd'));
        }
        if (filters.search) {
          const term = filters.search.replace(/[%,()]/g, ' ').trim();
          if (term) {
            query = query.or(
              [
                `action.ilike.%${term}%`,
                `entity_id.ilike.%${term}%`,
                `details->>name.ilike.%${term}%`,
                `details->>item_name.ilike.%${term}%`,
                `details->>order_number.ilike.%${term}%`,
                `details->>reason.ilike.%${term}%`,
              ].join(',')
            );
          }
        }
        return query.order('created_at', { ascending: false }).limit(PAGE_SIZE);
      };

      let { data, error } = await applyFilters(
        supabase.from('activity_logs').select('*, user:profiles(name, email), location:locations(name)')
      );

      if (error) {
        const retry = await applyFilters(supabase.from('activity_logs').select('*'));
        if (retry.error) throw retry.error;
        data = retry.data;
      }

      setLogs((data || []) as unknown as ActivityLog[]);
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
      const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      if (!details) return 'No details available';

      const name = details.name || details.item_name;

      // Server-side audit triggers: created / updated / deleted with a diff.
      if (log.action === 'created') {
        return `Created ${name ? `"${name}"` : ENTITY_LABELS[log.entity_type as LogEntityType]?.toLowerCase() || log.entity_type}`;
      }
      if (log.action === 'deleted') {
        return `Deleted ${name ? `"${name}"` : log.entity_type}`;
      }
      if (log.action === 'updated' && details.changes) {
        const changes = Object.entries(details.changes as Record<string, { from: unknown; to: unknown }>)
          .filter(([key]) => !['cost_per_item'].includes(key) || log.entity_type !== 'pos_item')
          .map(([key, change]) => {
            const fmt = (v: unknown) =>
              key === 'price' && typeof v === 'number' ? formatCurrency(v) : v === null || v === undefined ? 'empty' : String(v);
            return `${key.replace(/_/g, ' ')}: ${fmt(change.from)} -> ${fmt(change.to)}`;
          });
        return `${name ? `"${name}": ` : ''}${changes.join('; ') || 'updated'}`;
      }

      switch (log.action) {
        case 'order_created':
          return `Order ${details.order_number} (${details.order_type}, ${details.payment_method}) for ${formatCurrency(details.total_amount ?? 0)}${
            Array.isArray(details.unlinked_items) && details.unlinked_items.length
              ? ` - no stock moved for ${details.unlinked_items.join(', ')}`
              : ''
          }`;
        case 'order_status_changed':
          return `Order ${details.order_number}: ${details.from} -> ${details.to}`;
        case 'order_cancelled':
          return `Order ${details.order_number} cancelled${details.stock_restored ? ' (stock restored)' : ''}${
            details.reason ? `. Reason: ${details.reason}` : ''
          }`;
        case 'stock_adjusted':
          return `${details.item_name ?? 'Item'}: ${details.movement_type?.replace(/_/g, ' ')} ${
            details.quantity > 0 ? '+' : ''
          }${details.quantity} (now ${details.closing_stock})${details.notes ? `. ${details.notes}` : ''}`;
        case 'stock_transferred':
          return `Transferred ${details.quantity} of ${details.item_name ?? 'item'}${details.notes ? `. ${details.notes}` : ''}`;
        case 'request_fulfilled':
        case 'request_partially_fulfilled':
          return `Dispatched ${details.quantity} (${details.dispatched_quantity}/${details.requested_quantity} so far)`;
        default:
          if (log.action?.startsWith('staff.')) {
            return `${log.action.replace('staff.', '').replace(/_/g, ' ')} ${details.email ?? details.name ?? details.id ?? ''}`;
          }
          return JSON.stringify(details);
      }
    } catch (error) {
      console.error('Error formatting log details:', error);
      return 'Error displaying details';
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action === 'created' || action === 'order_created' || action.startsWith('request_fulfilled')) return 'bg-green-600';
    if (action === 'updated' || action === 'order_status_changed') return 'bg-blue-500';
    if (action === 'deleted' || action === 'order_cancelled') return 'bg-red-500';
    if (action.startsWith('stock_')) return 'bg-indigo-500';
    if (action.startsWith('request_')) return 'bg-violet-500';
    if (action.startsWith('staff.')) return 'bg-amber-600';
    return 'bg-gray-500';
  };

  const getEntityBadgeColor = (entityType: string) => {
    switch (entityType) {
      case 'inventory_item':
      case 'inventory_items':
      case 'category':
        return 'bg-emerald-500';
      case 'stock_request':
      case 'stock_requests':
      case 'transfer':
        return 'bg-blue-600';
      case 'stock_entry':
      case 'stock_entries':
        return 'bg-indigo-500';
      case 'recipe':
      case 'recipes':
      case 'recipe_item':
        return 'bg-pink-500';
      case 'profile':
      case 'profiles':
        return 'bg-amber-600';
      case 'location':
      case 'locations':
      case 'settings':
        return 'bg-teal-500';
      case 'pos_sale':
      case 'sales':
      case 'pos_item':
      case 'pos_category':
      case 'discount_rule':
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
          <TabsTrigger value="pos_sale">Orders</TabsTrigger>
          <TabsTrigger value="stock_entry">Stock</TabsTrigger>
          <TabsTrigger value="stock_request">Requests</TabsTrigger>
          <TabsTrigger value="transfer">Transfers</TabsTrigger>
          <TabsTrigger value="inventory_item">Inventory</TabsTrigger>
          <TabsTrigger value="pos_item">Menu</TabsTrigger>
          <TabsTrigger value="recipe">Recipes</TabsTrigger>
          <TabsTrigger value="profile">Users</TabsTrigger>
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
                            <Badge className={cn("capitalize whitespace-nowrap", getActionBadgeColor(log.action))}>
                              {log.action.replace(/^staff\./, 'staff ').replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("whitespace-nowrap", getEntityBadgeColor(log.entity_type))}>
                              {ENTITY_LABELS[log.entity_type as LogEntityType] ?? log.entity_type.replace(/_/g, ' ')}
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
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {ENTITY_LABELS[type]}
                      </SelectItem>
                    ))}
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
                    {ACTION_OPTIONS.map((action) => (
                      <SelectItem key={action} value={action} className="capitalize">
                        {action.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
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