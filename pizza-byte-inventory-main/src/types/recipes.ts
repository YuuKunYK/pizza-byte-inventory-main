// Recipe tagging system types

export type TagCategory = 'size' | 'type' | 'flavor';

export interface RecipeTag {
  id: string;
  name: string;
  category: TagCategory;
  color: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface RecipeTagAssignment {
  id: string;
  recipe_id: string;
  tag_id: string;
  assigned_at: string;
  assigned_by?: string;
}

export interface RecipeWithTags {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  tags: RecipeTag[];
}

// Helper functions for tag management
export const getTagByCategory = (tags: RecipeTag[], category: TagCategory): RecipeTag | undefined => {
  return tags.find(tag => tag.category === category);
};

export const getTagsByCategory = (tags: RecipeTag[], category: TagCategory): RecipeTag[] => {
  return tags.filter(tag => tag.category === category);
};

export const hasTagInCategory = (tags: RecipeTag[], category: TagCategory): boolean => {
  return tags.some(tag => tag.category === category);
};

// Predefined tag options for consistency
export const PIZZA_SIZE_TAGS = [
  '7 inch', '9 inch', '12 inch', '16 inch', '16 inch Half', 
  '21 inch', '21 inch Half', '21 inch Slice'
] as const;

export const CALZONE_SIZE_TAGS = [
  'Full Calzone', 'Half Calzone', 'Slice Calzone', 'Mini Calzone'
] as const;

export const ALL_SIZE_TAGS = [...PIZZA_SIZE_TAGS, ...CALZONE_SIZE_TAGS] as const;

export const PIZZA_TYPE_TAGS = ['Standard', 'Thin Crust'] as const;

export const FLAVOR_TAGS = [
  // Custom Pizza Flavors
  'New York Special', 'Peri Peri Chicken', 'Houston Hot', 'Downtown Ranch', 
  'Creamy Pleasure', 'Chicken Saucy BBQ', 'Beef Pepperoni', 'Chicken Pepperoni',
  'Chicken Tikka', 'Chicken Fajita', 'Creamy Ficato', 'Chicken Brooklyn',
  'Cheese Love', 'Veggie Love', 'Chicken Euro'
] as const;

export type PizzaSizeTag = typeof PIZZA_SIZE_TAGS[number];
export type CalzoneSizeTag = typeof CALZONE_SIZE_TAGS[number];
export type AllSizeTag = typeof ALL_SIZE_TAGS[number];
export type PizzaTypeTag = typeof PIZZA_TYPE_TAGS[number];
export type FlavorTag = typeof FLAVOR_TAGS[number]; 