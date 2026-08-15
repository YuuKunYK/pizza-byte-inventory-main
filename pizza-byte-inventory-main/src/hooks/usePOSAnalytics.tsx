import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { POSAnalytics, SalesFilters } from '@/types/pos';
import { getTodayRange } from '@/lib/pos-utils';

/**
 * Hook to fetch POS analytics data
 */
export const usePOSAnalytics = (filters?: SalesFilters) => {
  // Fetch aggregate analytics
  const {
    data: analytics,
    isLoading: isLoadingAnalytics,
    error: analyticsError,
  } = useQuery<POSAnalytics>({
    queryKey: ['pos_analytics', filters],
    queryFn: async () => {
      // Build query with filters
      let query = supabase.from('pos_sales').select('*');

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      if (filters?.branch_id) {
        query = query.eq('branch_id', filters.branch_id);
      }

      if (filters?.order_type) {
        query = query.eq('order_type', filters.order_type);
      }

      const { data: sales, error } = await query;

      if (error) throw error;

      const countable = (sales || []).filter((sale) => sale.status !== 'cancelled');

      // Calculate analytics from sales data
      const totalRevenue = countable.reduce((sum, sale) => sum + sale.total_amount, 0);
      const totalProfit = countable.reduce((sum, sale) => sum + sale.profit, 0);
      const totalOrders = countable.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calculate top selling items
      const itemSales = new Map<string, { name: string; quantity: number; revenue: number }>();

      countable.forEach((sale) => {
        const items = Array.isArray(sale.items) ? sale.items : [];
        items.forEach((item) => {
          const existing = itemSales.get(item.item_id) || {
            name: item.name,
            quantity: 0,
            revenue: 0,
          };
          existing.quantity += item.quantity;
          existing.revenue += item.total;
          itemSales.set(item.item_id, existing);
        });
      });

      const topSellingItems = Array.from(itemSales.entries())
        .map(([item_id, data]) => ({
          item_id,
          item_name: data.name,
          quantity_sold: data.quantity,
          revenue: data.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Calculate low margin items
      const itemMargins = new Map<
        string,
        { name: string; totalCost: number; totalRevenue: number; count: number }
      >();

      countable.forEach((sale) => {
        const items = Array.isArray(sale.items) ? sale.items : [];
        items.forEach((item) => {
          const existing = itemMargins.get(item.item_id) || {
            name: item.name,
            totalCost: 0,
            totalRevenue: 0,
            count: 0,
          };
          existing.totalCost += item.cost * item.quantity;
          existing.totalRevenue += item.total;
          existing.count += item.quantity;
          itemMargins.set(item.item_id, existing);
        });
      });

      const lowMarginItems = Array.from(itemMargins.entries())
        .map(([item_id, data]) => ({
          item_id,
          item_name: data.name,
          margin_percentage:
            data.totalRevenue > 0
              ? ((data.totalRevenue - data.totalCost) / data.totalRevenue) * 100
              : 0,
          total_sold: data.count,
        }))
        .filter((item) => item.total_sold > 0)
        .sort((a, b) => a.margin_percentage - b.margin_percentage)
        .slice(0, 10);

      // Sales by order type
      const orderTypeMap = new Map<string, { count: number; revenue: number }>();
      countable.forEach((sale) => {
        const existing = orderTypeMap.get(sale.order_type) || { count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += sale.total_amount;
        orderTypeMap.set(sale.order_type, existing);
      });

      const salesByOrderType = Array.from(orderTypeMap.entries()).map(([order_type, data]) => ({
        order_type,
        count: data.count,
        revenue: data.revenue,
      }));

      // Sales by payment method
      const paymentMethodMap = new Map<string, { count: number; revenue: number }>();
      countable.forEach((sale) => {
        const existing = paymentMethodMap.get(sale.payment_method) || { count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += sale.total_amount;
        paymentMethodMap.set(sale.payment_method, existing);
      });

      const salesByPaymentMethod = Array.from(paymentMethodMap.entries()).map(
        ([payment_method, data]) => ({
          payment_method,
          count: data.count,
          revenue: data.revenue,
        })
      );

      return {
        totalRevenue,
        totalProfit,
        totalOrders,
        averageOrderValue,
        topSellingItems,
        lowMarginItems,
        salesByOrderType,
        salesByPaymentMethod,
      };
    },
  });

  return {
    analytics,
    isLoadingAnalytics,
    analyticsError,
  };
};

/**
 * Hook to fetch today's sales summary for dashboard
 */
export const useTodaySalesSummary = (branchId?: string) => {
  const todayRange = getTodayRange();

  const filters: SalesFilters = {
    startDate: todayRange.start,
    endDate: todayRange.end,
  };

  if (branchId) {
    filters.branch_id = branchId;
  }

  const { analytics, isLoadingAnalytics } = usePOSAnalytics(filters);

  return {
    todayRevenue: analytics?.totalRevenue || 0,
    todayProfit: analytics?.totalProfit || 0,
    todayOrders: analytics?.totalOrders || 0,
    isLoading: isLoadingAnalytics,
  };
};

/**
 * Hook to fetch sales trends over time
 */
export const useSalesTrends = (filters?: SalesFilters) => {
  const {
    data: trends = [],
    isLoading: isLoadingTrends,
    error: trendsError,
  } = useQuery({
    queryKey: ['pos_sales_trends', filters],
    queryFn: async () => {
      let query = supabase.from('pos_sales').select('created_at, total_amount, profit, order_type');

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      if (filters?.branch_id) {
        query = query.eq('branch_id', filters.branch_id);
      }

      query = query.order('created_at', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      // Group by date
      const dateMap = new Map<
        string,
        { date: string; revenue: number; profit: number; orders: number }
      >();

      data.forEach((sale) => {
        const date = new Date(sale.created_at).toISOString().split('T')[0];
        const existing = dateMap.get(date) || { date, revenue: 0, profit: 0, orders: 0 };
        existing.revenue += sale.total_amount;
        existing.profit += sale.profit;
        existing.orders += 1;
        dateMap.set(date, existing);
      });

      return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    },
  });

  return {
    trends,
    isLoadingTrends,
    trendsError,
  };
};

