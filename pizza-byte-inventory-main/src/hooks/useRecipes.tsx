import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface RecipeIngredient {
  id?: string;
  itemId: string;
  quantity: number;
}

interface CreateRecipeParams {
  recipe: {
    name: string;
    description?: string;
  };
  ingredients: RecipeIngredient[];
}

interface UpdateRecipeParams {
  recipeId: string;
  recipe: {
    name: string;
    description?: string;
  };
  ingredients: RecipeIngredient[];
  deletedIngredientIds?: string[];
}

export const useRecipes = () => {
  const queryClient = useQueryClient();
  const [isAddRecipeDialogOpen, setIsAddRecipeDialogOpen] = useState(false);
  const [isEditRecipeDialogOpen, setIsEditRecipeDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  const { 
    data: recipes = [], 
    isLoading: isLoadingRecipes,
    isError: isRecipesError,
    error: recipesError
  } = useQuery({
    queryKey: ['recipes'],
    queryFn: async () => {
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .order('name');
      
      if (recipesError) throw recipesError;

      const recipesWithIngredients = await Promise.all(
        recipesData.map(async (recipe) => {
          const { data: ingredientsData, error: ingredientsError } = await supabase
            .from('recipe_items')
            .select('*, item:inventory_items(id, name, unit_type)')
            .eq('recipe_id', recipe.id);
          
          if (ingredientsError) throw ingredientsError;
          
          return {
            ...recipe,
            ingredients: ingredientsData.map(ingredient => ({
              id: ingredient.id,
              itemId: ingredient.item_id,
              name: ingredient.item?.name,
              quantity: ingredient.quantity,
              unit: ingredient.item?.unit_type
            }))
          };
        })
      );
      
      return recipesWithIngredients || [];
    }
  });

  const { 
    data: inventoryItems = [], 
    isLoading: isLoadingItems 
  } = useQuery({
    queryKey: ['inventory_items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*, category:categories(id, name)')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  const createRecipeMutation = useMutation({
    mutationFn: async ({ recipe, ingredients }: CreateRecipeParams) => {
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .insert(recipe)
        .select();
      
      if (recipeError) throw recipeError;
      
      if (ingredients.length > 0) {
        const recipeItems = ingredients.map(ingredient => ({
          recipe_id: recipeData[0].id,
          item_id: ingredient.itemId,
          quantity: ingredient.quantity
        }));
        
        const { error: itemsError } = await supabase
          .from('recipe_items')
          .insert(recipeItems);
        
        if (itemsError) throw itemsError;
      }
      
      return recipeData[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setIsAddRecipeDialogOpen(false);
      toast.success('Recipe created successfully');
    },
    onError: (error) => {
      console.error('Error creating recipe:', error);
      toast.error('Failed to create recipe', {
        description: error.message
      });
    }
  });

  const updateRecipeMutation = useMutation({
    mutationFn: async ({ recipeId, recipe, ingredients, deletedIngredientIds }: UpdateRecipeParams) => {
      const { error: recipeError } = await supabase
        .from('recipes')
        .update(recipe)
        .eq('id', recipeId);
      
      if (recipeError) throw recipeError;
      
      if (deletedIngredientIds?.length > 0) {
        const { error: deleteError } = await supabase
          .from('recipe_items')
          .delete()
          .in('id', deletedIngredientIds);
        
        if (deleteError) throw deleteError;
      }
      
      for (const ingredient of ingredients) {
        if (ingredient.id) {
          const { error: updateError } = await supabase
            .from('recipe_items')
            .update({
              item_id: ingredient.itemId,
              quantity: ingredient.quantity
            })
            .eq('id', ingredient.id);
          
          if (updateError) throw updateError;
        } else {
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
      
      return { id: recipeId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setIsEditRecipeDialogOpen(false);
      setSelectedRecipe(null);
      toast.success('Recipe updated successfully');
    },
    onError: (error) => {
      console.error('Error updating recipe:', error);
      toast.error('Failed to update recipe', {
        description: error.message
      });
    }
  });

  const deleteRecipeMutation = useMutation({
    mutationFn: async (recipeId: string) => {
      const { error: itemsError } = await supabase
        .from('recipe_items')
        .delete()
        .eq('recipe_id', recipeId);
      
      if (itemsError) throw itemsError;
      
      const { error: recipeError } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId);
      
      if (recipeError) throw recipeError;
      
      return { id: recipeId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Recipe deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting recipe:', error);
      toast.error('Failed to delete recipe', {
        description: error.message
      });
    }
  });

  return {
    recipes,
    inventoryItems,
    isLoadingRecipes,
    isLoadingItems,
    isRecipesError,
    recipesError,
    isAddRecipeDialogOpen,
    setIsAddRecipeDialogOpen,
    isEditRecipeDialogOpen,
    setIsEditRecipeDialogOpen,
    selectedRecipe,
    setSelectedRecipe,
    createRecipe: (params: CreateRecipeParams) => createRecipeMutation.mutate(params),
    updateRecipe: (params: UpdateRecipeParams) => updateRecipeMutation.mutate(params),
    deleteRecipe: (recipeId: string) => deleteRecipeMutation.mutate(recipeId),
    isCreatingRecipe: createRecipeMutation.isPending,
    isUpdatingRecipe: updateRecipeMutation.isPending,
    isDeletingRecipe: deleteRecipeMutation.isPending
  };
};
