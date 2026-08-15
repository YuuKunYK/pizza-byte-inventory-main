import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useState } from 'react';
import type { RecipeTag, TagCategory } from '@/types/recipes';

export interface Recipe {
  id: string;
    name: string;
    description?: string;
  created_at: string;
  updated_at: string;
  ingredients: any[];
  tags?: RecipeTag[];
}

export interface InventoryItem {
  id: string;
  name: string;
  cost_per_unit: number;
  unit_type: string;
  base_unit?: string;
  category?: {
    name: string;
  };
}

export const useRecipes = () => {
  const [isAddRecipeDialogOpen, setIsAddRecipeDialogOpen] = useState(false);
  const [isEditRecipeDialogOpen, setIsEditRecipeDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const queryClient = useQueryClient();

  // Fetch recipes with tags
  const { 
    data: recipes = [], 
    isLoading: isLoadingRecipes,
    error: recipesError
  } = useQuery({
    queryKey: ['recipes'],
    queryFn: async (): Promise<Recipe[]> => {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          recipe_items(
            id,
            quantity,
            item_id,
            inventory_item:inventory_items(
              id,
              name,
              cost_per_unit,
              unit_type,
              base_unit,
              purchase_unit,
              purchase_conversion_value,
              category:categories(name)
            )
          ),
          recipe_tag_assignments(
            recipe_tags(
              id,
              name,
              category,
              color,
              description
            )
          )
        `)
        .order('created_at', { ascending: false });
          
      if (error) {
        console.error('Error fetching recipes:', error);
        throw error;
      }

      return (data || []).map(recipe => ({
            ...recipe,
        ingredients: recipe.recipe_items?.map(item => ({
          id: item.id,
          itemId: item.inventory_item?.id || item.item_id,
          quantity: item.quantity,
          inventory_item: item.inventory_item
        })) || [],
        tags: recipe.recipe_tag_assignments?.map(assignment => assignment.recipe_tags).filter(Boolean) || []
      }));
    }
  });

  // Fetch inventory items
  const { 
    data: inventoryItems = [], 
    isLoading: isLoadingItems,
    error: itemsError
  } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async (): Promise<InventoryItem[]> => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          *,
          categories(name)
        `)
        .order('name');
      
      if (error) {
        console.error('Error fetching inventory items:', error);
        throw error;
      }

      return data || [];
    }
  });

  // Create recipe mutation
  const createRecipeMutation = useMutation({
    mutationFn: async (params: any) => {
      const { recipe, ingredients } = params;
      
      // Insert recipe
      const { data: newRecipe, error: recipeError } = await supabase
        .from('recipes')
        .insert(recipe)
        .select()
        .single();
      
      if (recipeError) throw recipeError;
      
      // Insert ingredients
      if (ingredients.length > 0) {
        const recipeItems = ingredients.map((ingredient: any) => ({
          recipe_id: newRecipe.id,
          item_id: ingredient.itemId,
          quantity: ingredient.quantity
        }));
        
        const { error: itemsError } = await supabase
          .from('recipe_items')
          .insert(recipeItems);
        
        if (itemsError) throw itemsError;
      }
      
      return newRecipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Recipe created successfully');
      setIsAddRecipeDialogOpen(false);
    },
    onError: (error) => {
      console.error('Error creating recipe:', error);
      toast.error('Failed to create recipe');
    }
  });

  // Update recipe mutation
  const updateRecipeMutation = useMutation({
    mutationFn: async (params: any) => {
      const { recipeId, recipe, ingredients, deletedIngredientIds } = params;
      
      // Update recipe
      const { error: recipeError } = await supabase
        .from('recipes')
        .update(recipe)
        .eq('id', recipeId);
      
      if (recipeError) throw recipeError;
      
      // Delete removed ingredients
      if (deletedIngredientIds && deletedIngredientIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('recipe_items')
          .delete()
          .in('id', deletedIngredientIds);
        
        if (deleteError) throw deleteError;
      }
      
      // Update/insert ingredients
      for (const ingredient of ingredients) {
        if (ingredient.id) {
          // Update existing
          const { error: updateError } = await supabase
            .from('recipe_items')
            .update({
              item_id: ingredient.itemId,
              quantity: ingredient.quantity
            })
            .eq('id', ingredient.id);
          
          if (updateError) throw updateError;
        } else {
          // Insert new
          const { error: insertError } = await supabase
            .from('recipe_items')
            .insert({
              recipe_id: recipeId,
              item_id: ingredient.itemId,
              quantity: ingredient.quantity
            });
          
          if (insertError) throw insertError;
        }
      }
      
      return { recipeId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Recipe updated successfully');
      setIsEditRecipeDialogOpen(false);
    },
    onError: (error) => {
      console.error('Error updating recipe:', error);
      toast.error('Failed to update recipe');
    }
  });

  // Delete recipe mutation
  const deleteRecipeMutation = useMutation({
    mutationFn: async (recipeId: string) => {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId);
      
      if (error) throw error;
      return recipeId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Recipe deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting recipe:', error);
      toast.error('Failed to delete recipe');
    }
  });

  // Filter recipes by tags
  const filterRecipesByTags = (recipes: Recipe[], selectedTags: RecipeTag[]) => {
    if (selectedTags.length === 0) return recipes;
    
    return recipes.filter(recipe => {
      if (!recipe.tags || recipe.tags.length === 0) return false;
      
      // Check if recipe has all selected tags
      return selectedTags.every(selectedTag => 
        recipe.tags!.some(recipeTag => recipeTag.id === selectedTag.id)
      );
    });
  };

  // Filter recipes by category
  const filterRecipesByCategory = (recipes: Recipe[], category: TagCategory, tagIds: string[]) => {
    if (tagIds.length === 0) return recipes;
    
    return recipes.filter(recipe => {
      if (!recipe.tags || recipe.tags.length === 0) return false;
      
      // Check if recipe has any of the selected tags in the specified category
      return recipe.tags.some(tag => 
        tag.category === category && tagIds.includes(tag.id)
      );
    });
  };

  return {
    // Data
    recipes,
    inventoryItems,
    
    // Loading states
    isLoadingRecipes,
    isLoadingItems,
    
    // Errors
    recipesError,
    itemsError,
    
    // UI state
    isAddRecipeDialogOpen,
    setIsAddRecipeDialogOpen,
    isEditRecipeDialogOpen,
    setIsEditRecipeDialogOpen,
    selectedRecipe,
    setSelectedRecipe,
    
    // Mutations
    createRecipe: createRecipeMutation.mutate,
    updateRecipe: updateRecipeMutation.mutate,
    deleteRecipe: deleteRecipeMutation.mutate,
    
    // Mutation states
    isCreatingRecipe: createRecipeMutation.isPending,
    isUpdatingRecipe: updateRecipeMutation.isPending,
    isDeletingRecipe: deleteRecipeMutation.isPending,
    
    // Filter helpers
    filterRecipesByTags,
    filterRecipesByCategory
  };
};
