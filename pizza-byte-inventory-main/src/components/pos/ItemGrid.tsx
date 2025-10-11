import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { POSItemWithDetails } from '@/types/pos';
import { formatCurrency, paisaToPkr } from '@/types/pos';
import { cn } from '@/lib/utils';
import { PackageX, ImageOff } from 'lucide-react';

interface ItemGridProps {
  items: POSItemWithDetails[];
  onItemClick: (item: POSItemWithDetails) => void;
  isLoading?: boolean;
}

export const ItemGrid: React.FC<ItemGridProps> = ({ items, onItemClick, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="aspect-square bg-muted rounded-md mb-3" />
              <div className="h-4 bg-muted rounded mb-2" />
              <div className="h-6 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <PackageX className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Items Found</h3>
          <p className="text-sm text-muted-foreground">
            No items available in this category. Try selecting a different category or contact admin to add items.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {items.map((item) => (
        <Card
          key={item.id}
          className={cn(
            'cursor-pointer transition-all hover:shadow-lg hover:scale-105',
            !item.available && 'opacity-50 cursor-not-allowed'
          )}
          onClick={() => item.available && onItemClick(item)}
        >
          <CardContent className="p-4">
            {/* Item Image */}
            <div className="aspect-square bg-muted rounded-md mb-3 overflow-hidden relative">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageOff className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              {!item.available && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Badge variant="destructive">Out of Stock</Badge>
                </div>
              )}
            </div>

            {/* Item Info */}
            <div className="space-y-1">
              <h4 className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{item.name}</h4>
              
              {item.subcategory && (
                <Badge variant="outline" className="text-xs">
                  {item.subcategory.name}
                </Badge>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(item.price)}
                </span>
              </div>

              {item.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

