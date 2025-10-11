import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { POSCategoryWithSubcategories } from '@/types/pos';
import { cn } from '@/lib/utils';
import { ChevronRight, Grid3x3 } from 'lucide-react';

interface CategoryGridProps {
  categories: POSCategoryWithSubcategories[];
  selectedCategory: string | null;
  selectedSubcategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  onSelectSubcategory: (subcategoryId: string | null) => void;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  selectedCategory,
  selectedSubcategory,
  onSelectCategory,
  onSelectSubcategory,
}) => {
  const selectedCategoryData = categories.find((cat) => cat.id === selectedCategory);

  return (
    <div className="space-y-4">
      {/* Main Categories */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            onSelectCategory(null);
            onSelectSubcategory(null);
          }}
          className="h-9"
        >
          <Grid3x3 className="mr-2 h-4 w-4" />
          All Items
        </Button>

        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              onSelectCategory(category.id);
              onSelectSubcategory(null);
            }}
            className="h-9"
          >
            {category.icon && <span className="mr-2">{category.icon}</span>}
            {category.name}
            {category.subcategories && category.subcategories.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {category.subcategories.length}
              </Badge>
            )}
            {category.subcategories && category.subcategories.length > 0 && (
              <ChevronRight className="ml-1 h-3 w-3" />
            )}
          </Button>
        ))}
      </div>

      {/* Subcategories */}
      {selectedCategoryData && selectedCategoryData.subcategories && selectedCategoryData.subcategories.length > 0 && (
        <Card className="p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedSubcategory === null ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onSelectSubcategory(null)}
              className="h-8"
            >
              All {selectedCategoryData.name}
            </Button>

            {selectedCategoryData.subcategories.map((subcategory) => (
              <Button
                key={subcategory.id}
                variant={selectedSubcategory === subcategory.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onSelectSubcategory(subcategory.id)}
                className="h-8"
              >
                {subcategory.icon && <span className="mr-2">{subcategory.icon}</span>}
                {subcategory.name}
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

