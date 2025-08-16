import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import type { RecipeTag, TagCategory, RecipeTagAssignment } from '@/types/recipes';

export const useRecipeTags = () => {
  const queryClient = useQueryClient();

  // Fetch all available tags
  const {
    data: allTags = [],
    isLoading: isLoadingTags,
    error: tagsError
  } = useQuery({
    queryKey: ['recipe-tags'],
    queryFn: async (): Promise<RecipeTag[]> => {
      const { data, error } = await supabase
        .from('recipe_tags')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching recipe tags:', error);
        throw error;
      }

      return data || [];
    }
  });

  // Fetch tags by category
  const getTagsByCategory = (category: TagCategory): RecipeTag[] => {
    return allTags.filter(tag => tag.category === category);
  };

  // Fetch recipe tags for a specific recipe
  const useRecipeTagsQuery = (recipeId: string) => {
    return useQuery({
      queryKey: ['recipe-tags', recipeId],
      queryFn: async (): Promise<RecipeTag[]> => {
        const { data, error } = await supabase
          .from('recipe_tag_assignments')
          .select(`
            recipe_tags (
              id,
              name,
              category,
              color,
              description,
              created_at,
              updated_at
            )
          `)
          .eq('recipe_id', recipeId);

        if (error) {
          console.error('Error fetching recipe tags:', error);
          throw error;
        }

        return data?.map(item => item.recipe_tags).filter(Boolean) || [];
      },
      enabled: !!recipeId
    });
  };

  // Assign tag to recipe
  const assignTagMutation = useMutation({
    mutationFn: async ({ recipeId, tagId }: { recipeId: string; tagId: string }) => {
      // First, get the tag category to check for existing tags in the same category
      const { data: tag, error: tagError } = await supabase
        .from('recipe_tags')
        .select('category')
        .eq('id', tagId)
        .single();

      if (tagError) throw tagError;

      // Get all tag IDs in the same category
      const { data: categoryTags, error: categoryError } = await supabase
        .from('recipe_tags')
        .select('id')
        .eq('category', tag.category);

      if (categoryError) throw categoryError;

      const categoryTagIds = categoryTags?.map(t => t.id) || [];

      // Remove any existing tag of the same category for this recipe
      if (categoryTagIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('recipe_tag_assignments')
          .delete()
          .eq('recipe_id', recipeId)
          .in('tag_id', categoryTagIds);

        if (deleteError) throw deleteError;
      }

      // Insert new tag assignment
      const { data, error } = await supabase
        .from('recipe_tag_assignments')
        .insert({
          recipe_id: recipeId,
          tag_id: tagId
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { recipeId }) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-tags', recipeId] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Tag assigned successfully');
    },
    onError: (error) => {
      console.error('Error assigning tag:', error);
      toast.error('Failed to assign tag');
    }
  });

  // Remove tag from recipe
  const removeTagMutation = useMutation({
    mutationFn: async ({ recipeId, tagId }: { recipeId: string; tagId: string }) => {
      const { error } = await supabase
        .from('recipe_tag_assignments')
        .delete()
        .eq('recipe_id', recipeId)
        .eq('tag_id', tagId);

      if (error) throw error;
    },
    onSuccess: (_, { recipeId }) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-tags', recipeId] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Tag removed successfully');
    },
    onError: (error) => {
      console.error('Error removing tag:', error);
      toast.error('Failed to remove tag');
    }
  });

  // Create new tag
  const createTagMutation = useMutation({
    mutationFn: async (tag: Omit<RecipeTag, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('recipe_tags')
        .insert(tag)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-tags'] });
      toast.success('Tag created successfully');
    },
    onError: (error) => {
      console.error('Error creating tag:', error);
      toast.error('Failed to create tag');
    }
  });

  // Update tag
  const updateTagMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RecipeTag> & { id: string }) => {
      const { data, error } = await supabase
        .from('recipe_tags')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-tags'] });
      toast.success('Tag updated successfully');
    },
    onError: (error) => {
      console.error('Error updating tag:', error);
      toast.error('Failed to update tag');
    }
  });

  // Delete tag
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from('recipe_tags')
        .delete()
        .eq('id', tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-tags'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Tag deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting tag:', error);
      toast.error('Failed to delete tag');
    }
  });

  return {
    // Data
    allTags,
    getTagsByCategory,
    
    // Loading states
    isLoadingTags,
    
    // Errors
    tagsError,
    
    // Queries
    useRecipeTagsQuery,
    
    // Mutations
    assignTag: assignTagMutation.mutate,
    removeTag: removeTagMutation.mutate,
    createTag: createTagMutation.mutate,
    updateTag: updateTagMutation.mutate,
    deleteTag: deleteTagMutation.mutate,
    
    // Loading states for mutations
    isAssigningTag: assignTagMutation.isPending,
    isRemovingTag: removeTagMutation.isPending,
    isCreatingTag: createTagMutation.isPending,
    isUpdatingTag: updateTagMutation.isPending,
    isDeletingTag: deleteTagMutation.isPending
  };
}; 