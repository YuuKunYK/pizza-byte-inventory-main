import React, { useState, useMemo } from 'react';
import {
  ChefHat,
  Filter,
  FileDown,
  FileUp,
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Pizza,
  Loader2,
  Calculator,
  Package,
  Clock,
  Users,
  AlertCircle,
  Check,
  X,
  Star,
  BookOpen,
  Utensils,
  Scale,
  Settings,
  Wheat,
  Tags,
  Edit3,
  Save,
  TagIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useRecipes } from '@/hooks/useRecipes';
import { useRecipeTags } from '@/hooks/useRecipeTags';
import { useDoughConfig } from '@/hooks/useDoughConfig';
import { toast } from '@/components/ui/sonner';
import { getBaseUnitDisplayName } from '@/types/inventory';
import { formatUnitLabel } from '@/lib/units';
import { getTagsByCategory, type RecipeTag, type TagCategory } from '@/types/recipes';

interface RecipeIngredient {
  id?: string;
  itemId: string;
  quantity: number;
  tempId?: string; // For client-side tracking
  section?: 'dough' | 'sauce' | 'toppings' | 'other'; // Pizza sections
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

// Pizza configuration
interface PizzaSize {
  id: string;
  name: string;
  standardDough: number; // Standard pizza dough in grams
  thinCrustDough: number; // Thin crust pizza dough in grams
}

interface CalzoneSize {
  id: string;
  name: string;
  doughAmount: number; // Calzone dough in grams
}

interface PizzaType {
  id: string;
  name: string;
}

const PIZZA_SIZES: PizzaSize[] = [
  { id: '7inch', name: '7 inch', standardDough: 150, thinCrustDough: 70 },
  { id: '9inch', name: '9 inch', standardDough: 250, thinCrustDough: 150 },
  { id: '12inch', name: '12 inch', standardDough: 450, thinCrustDough: 250 },
  { id: '16inch', name: '16 inch', standardDough: 700, thinCrustDough: 400 },
  { id: '16inch_half', name: '16 inch Half', standardDough: 400, thinCrustDough: 250 },
  { id: '21inch', name: '21 inch', standardDough: 1050, thinCrustDough: 750 },
  { id: '21inch_half', name: '21 inch Half', standardDough: 500, thinCrustDough: 390 },
  { id: '21inch_slice', name: '21 inch Slice', standardDough: 225, thinCrustDough: 150 },
];

const CALZONE_SIZES: CalzoneSize[] = [
  { id: 'full', name: 'Full', doughAmount: 1000 },
  { id: 'half', name: 'Half', doughAmount: 500 },
  { id: 'slice', name: 'Slice', doughAmount: 150 },
  { id: 'mini', name: 'Mini', doughAmount: 70 },
];

const PIZZA_TYPES: PizzaType[] = [
  { id: 'standard', name: 'Standard' },
  { id: 'thin_crust', name: 'Thin Crust' },
];

const RECIPE_CATEGORIES = [
  { id: 'pizza', name: 'Pizza', icon: Pizza, color: 'bg-red-500' },
  { id: 'sides', name: 'Sides', icon: Package, color: 'bg-orange-500' },
  { id: 'desserts', name: 'Desserts', icon: Star, color: 'bg-pink-500' },
  { id: 'beverages', name: 'Beverages', icon: Utensils, color: 'bg-blue-500' },
  { id: 'appetizers', name: 'Appetizers', icon: BookOpen, color: 'bg-green-500' },
];

const INGREDIENT_SECTIONS = [
  { id: 'dough', name: 'Dough', icon: Wheat, color: 'bg-secondary/50 border-secondary' },
  { id: 'sauce', name: 'Sauce', icon: Utensils, color: 'bg-secondary/50 border-secondary' },
  { id: 'toppings', name: 'Toppings', icon: Pizza, color: 'bg-secondary/50 border-secondary' },
  { id: 'other', name: 'Other', icon: Package, color: 'bg-muted/30 border-muted' },
];

const Recipes = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Tag filtering states
  const [selectedSizeTags, setSelectedSizeTags] = useState<string[]>([]);
  const [selectedTypeTags, setSelectedTypeTags] = useState<string[]>([]);
  const [selectedFlavorTags, setSelectedFlavorTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Tag management states
  const [isTagManagementOpen, setIsTagManagementOpen] = useState(false);
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [isEditTagOpen, setIsEditTagOpen] = useState(false);
  const [selectedTagForEdit, setSelectedTagForEdit] = useState<RecipeTag | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagCategory, setNewTagCategory] = useState<TagCategory>('flavor');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [newTagDescription, setNewTagDescription] = useState('');

  // Recipe tag assignment states
  const [isAssignTagOpen, setIsAssignTagOpen] = useState(false);
  const [selectedRecipeForTagging, setSelectedRecipeForTagging] = useState<string | null>(null);
  
  // Recipe form states - Create
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeCategory, setNewRecipeCategory] = useState('');
  const [newRecipeDescription, setNewRecipeDescription] = useState('');
  const [newIngredients, setNewIngredients] = useState<(RecipeIngredient & { tempId: string })[]>([
    { itemId: '', quantity: 0, tempId: 'temp-1', section: 'other' }
  ]);
  
  // Pizza-specific states
  const [selectedPizzaSize, setSelectedPizzaSize] = useState<string>('');
  const [selectedPizzaType, setSelectedPizzaType] = useState<string>('standard');
  const [selectedCalzoneSize, setSelectedCalzoneSize] = useState<string>('');
  const [isPizzaMode, setIsPizzaMode] = useState(false);
  const [isCalzoneMode, setIsCalzoneMode] = useState(false);
  
  // Recipe form states - Edit
  const [editRecipeName, setEditRecipeName] = useState('');
  const [editRecipeCategory, setEditRecipeCategory] = useState('');
  const [editRecipeDescription, setEditRecipeDescription] = useState('');
  const [editIngredients, setEditIngredients] = useState<any[]>([]);
  const [deletedIngredientIds, setDeletedIngredientIds] = useState<string[]>([]);

  // UI states
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [activeStep, setActiveStep] = useState(1); // 1: Basic Info, 2: Ingredients, 3: Review
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState('');
  const [isDoughConfigOpen, setIsDoughConfigOpen] = useState(false);
  const [isRecipeDetailsOpen, setIsRecipeDetailsOpen] = useState(false);
  const [selectedRecipeForDetails, setSelectedRecipeForDetails] = useState<any>(null);
  const [isEditingInDetails, setIsEditingInDetails] = useState(false);
  
  // Dough configuration state (would typically come from settings/database)
  const [doughConfig, setDoughConfig] = useState(PIZZA_SIZES);
  const [calzoneDoughConfig, setCalzoneDoughConfig] = useState(CALZONE_SIZES);

  const {
    recipes,
    inventoryItems,
    isLoadingRecipes,
    isLoadingItems,
    isAddRecipeDialogOpen,
    setIsAddRecipeDialogOpen,
    isEditRecipeDialogOpen,
    setIsEditRecipeDialogOpen,
    selectedRecipe,
    setSelectedRecipe,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    isCreatingRecipe,
    isUpdatingRecipe,
    isDeletingRecipe,
    filterRecipesByCategory
  } = useRecipes();

  // Load recipe tags
  const {
    allTags,
    getTagsByCategory: getTagsByCat,
    isLoadingTags,
    assignTag,
    removeTag,
    createTag,
    updateTag,
    deleteTag,
    isCreatingTag,
    isUpdatingTag,
    isDeletingTag
  } = useRecipeTags();

  // Load dough configuration from Supabase
  const {
    pizzaDoughConfig,
    calzoneDoughConfig: calzoneConfigFromDB,
    isLoading: isDoughConfigLoading,
    updatePizzaDoughConfig,
    updateCalzoneDoughConfig,
    isUpdating: isDoughConfigUpdating
  } = useDoughConfig();

  // Local editing states for the configuration dialog
  const [editingPizzaConfig, setEditingPizzaConfig] = useState<any[]>([]);
  const [editingCalzoneConfig, setEditingCalzoneConfig] = useState<any[]>([]);

  // Use database values or fallback to constants
  const activePizzaDoughConfig = pizzaDoughConfig.length > 0 ? pizzaDoughConfig : PIZZA_SIZES;
  const activeCalzoneDoughConfig = calzoneConfigFromDB.length > 0 ? calzoneConfigFromDB : CALZONE_SIZES;

  // Initialize editing state when dialog opens
  React.useEffect(() => {
    if (isDoughConfigOpen) {
      setEditingPizzaConfig([...activePizzaDoughConfig]);
      setEditingCalzoneConfig([...activeCalzoneDoughConfig]);
    }
  }, [isDoughConfigOpen, activePizzaDoughConfig, activeCalzoneDoughConfig]);

  // Helper functions to handle property mapping between database and local types
  const getPizzaDoughAmount = (size: any, type: 'standard' | 'thin_crust') => {
    if ('standard_dough' in size) {
      // Database format
      return type === 'thin_crust' ? size.thin_crust_dough : size.standard_dough;
    } else {
      // Local format
      return type === 'thin_crust' ? size.thinCrustDough : size.standardDough;
    }
  };

  const getPizzaName = (size: any) => {
    return 'size_name' in size ? size.size_name : size.name;
  };

  const getPizzaId = (size: any) => {
    return 'size_id' in size ? size.size_id : size.id;
  };

  const getCalzoneDoughAmount = (size: any) => {
    return 'dough_amount' in size ? size.dough_amount : size.doughAmount;
  };

  const getCalzoneName = (size: any) => {
    return 'size_name' in size ? size.size_name : size.name;
  };

  const getCalzoneId = (size: any) => {
    return 'size_id' in size ? size.size_id : size.id;
  };

  // Helper function to update editing state with proper property names
  const updateEditingPizzaConfig = (index: number, field: 'standard' | 'thin_crust', value: number) => {
    const newConfig = [...editingPizzaConfig];
    const item = newConfig[index];
    
    if ('standard_dough' in item) {
      // Database format
      if (field === 'standard') {
        item.standard_dough = value;
      } else {
        item.thin_crust_dough = value;
      }
    } else {
      // Local format
      if (field === 'standard') {
        item.standardDough = value;
      } else {
        item.thinCrustDough = value;
      }
    }
    
    setEditingPizzaConfig(newConfig);
  };

  const updateEditingCalzoneConfig = (index: number, value: number) => {
    const newConfig = [...editingCalzoneConfig];
    const item = newConfig[index];
    
    if ('dough_amount' in item) {
      // Database format
      item.dough_amount = value;
    } else {
      // Local format
      item.doughAmount = value;
    }
    
    setEditingCalzoneConfig(newConfig);
  };

  // Filter and search logic with tag filtering
  const filteredRecipes = useMemo(() => {
    let filtered = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          recipe.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || selectedCategory === newRecipeCategory;
    
    return matchesSearch && matchesCategory;
  });

    // Apply tag filters
    if (selectedSizeTags.length > 0) {
      filtered = filterRecipesByCategory(filtered, 'size', selectedSizeTags);
    }
    
    if (selectedTypeTags.length > 0) {
      filtered = filterRecipesByCategory(filtered, 'type', selectedTypeTags);
    }
    
    if (selectedFlavorTags.length > 0) {
      filtered = filterRecipesByCategory(filtered, 'flavor', selectedFlavorTags);
    }

    return filtered;
  }, [recipes, searchQuery, selectedCategory, newRecipeCategory, selectedSizeTags, selectedTypeTags, selectedFlavorTags, filterRecipesByCategory]);

  const filteredInventoryItems = useMemo(() => {
    return inventoryItems.filter(item => 
      item.name.toLowerCase().includes(ingredientSearchQuery.toLowerCase())
    );
  }, [inventoryItems, ingredientSearchQuery]);

  // Get available tags by category
  const availableSizeTags = useMemo(() => getTagsByCat('size'), [allTags]);
  const availableTypeTags = useMemo(() => getTagsByCat('type'), [allTags]);
  const availableFlavorTags = useMemo(() => getTagsByCat('flavor'), [allTags]);

  // Tag filter handlers
  const handleTagFilter = (category: TagCategory, tagId: string, checked: boolean) => {
    if (category === 'size') {
      setSelectedSizeTags(prev => 
        checked ? [...prev, tagId] : prev.filter(id => id !== tagId)
      );
    } else if (category === 'type') {
      setSelectedTypeTags(prev => 
        checked ? [...prev, tagId] : prev.filter(id => id !== tagId)
      );
    } else if (category === 'flavor') {
      setSelectedFlavorTags(prev => 
        checked ? [...prev, tagId] : prev.filter(id => id !== tagId)
      );
    }
  };

  const clearAllFilters = () => {
    setSelectedSizeTags([]);
    setSelectedTypeTags([]);
    setSelectedFlavorTags([]);
  };

  // Helper function to safely get base unit display name
  const safeGetBaseUnitDisplayName = (baseUnit: any, unitType: any) => {
    if (baseUnit && typeof baseUnit === 'string') {
      return getBaseUnitDisplayName(baseUnit as any);
    }
    return formatUnitLabel(unitType) || unitType || '';
  };

  // Get ingredients by section for pizza mode
  const ingredientsBySection = useMemo(() => {
    if (!isPizzaMode) return { other: newIngredients };
    
    return newIngredients.reduce((acc, ingredient) => {
      const section = ingredient.section || 'other';
      if (!acc[section]) acc[section] = [];
      acc[section].push(ingredient);
      return acc;
    }, {} as Record<string, typeof newIngredients>);
  }, [newIngredients, isPizzaMode]);

  // Get sauce ingredients for dropdown
  const sauceIngredients = useMemo(() => {
    return inventoryItems.filter(item => 
      item.name.toLowerCase().includes('sauce') || 
      item.category?.name?.toLowerCase().includes('sauce')
    );
  }, [inventoryItems]);

  // Get dough ingredients
  const doughIngredients = useMemo(() => {
    return inventoryItems.filter(item => 
      item.name.toLowerCase().includes('dough') || 
      item.name.toLowerCase().includes('flour') ||
      item.category?.name?.toLowerCase().includes('dough')
    );
  }, [inventoryItems]);

  // Pizza size and type selection handlers
  const handlePizzaSizeChange = (sizeId: string) => {
    setSelectedPizzaSize(sizeId);
    
    const size = activePizzaDoughConfig.find(s => getPizzaId(s) === sizeId);
    const type = PIZZA_TYPES.find(t => t.id === selectedPizzaType);
    
    if (size && type) {
      const doughAmount = getPizzaDoughAmount(size, type.id === 'thin_crust' ? 'thin_crust' : 'standard');
      
      // Update or add dough ingredient
      const doughIngredient = doughIngredients[0]; // Use first dough ingredient found
      if (doughIngredient) {
        setNewIngredients(prev => {
          const existingDoughIndex = prev.findIndex(ing => ing.section === 'dough');
          if (existingDoughIndex >= 0) {
            // Update existing dough
            const updated = [...prev];
            updated[existingDoughIndex] = {
              ...updated[existingDoughIndex],
              itemId: doughIngredient.id,
              quantity: doughAmount
            };
            return updated;
          } else {
            // Add new dough ingredient
            return [...prev, {
              itemId: doughIngredient.id,
              quantity: doughAmount,
              tempId: `dough-${Date.now()}`,
              section: 'dough'
            }];
          }
        });
      }
    }
  };

  const handlePizzaTypeChange = (typeId: string) => {
    setSelectedPizzaType(typeId);
    
    // Recalculate dough if size is selected
    if (selectedPizzaSize) {
      handlePizzaSizeChange(selectedPizzaSize);
    }
  };

  // Calzone size selection handler
  const handleCalzoneSizeChange = (sizeId: string) => {
    setSelectedCalzoneSize(sizeId);
    
    const size = activeCalzoneDoughConfig.find(s => getCalzoneId(s) === sizeId);
    
    if (size) {
      const doughAmount = getCalzoneDoughAmount(size);
      
      // Update or add dough ingredient
      const doughIngredient = doughIngredients[0]; // Use first dough ingredient found
      if (doughIngredient) {
        setNewIngredients(prev => {
          const existingDoughIndex = prev.findIndex(ing => ing.section === 'dough');
          if (existingDoughIndex >= 0) {
            // Update existing dough
            const updated = [...prev];
            updated[existingDoughIndex] = {
              ...updated[existingDoughIndex],
              itemId: doughIngredient.id,
              quantity: doughAmount
            };
            return updated;
          } else {
            // Add new dough ingredient
            return [...prev, {
              itemId: doughIngredient.id,
              quantity: doughAmount,
              tempId: `dough-${Date.now()}`,
              section: 'dough'
            }];
          }
        });
      }
    }
  };

  // Ingredient management for create mode
  const handleAddIngredient = (section: string = 'other') => {
    const tempId = `temp-${Date.now()}`;
    setNewIngredients([...newIngredients, { itemId: '', quantity: 0, tempId, section: section as any }]);
  };

  const handleRemoveIngredient = (tempId: string) => {
    setNewIngredients(newIngredients.filter(ing => ing.tempId !== tempId));
  };

  const handleIngredientChange = (tempId: string, field: string, value: string | number) => {
    setNewIngredients(prev => prev.map(ing => 
      ing.tempId === tempId 
        ? { ...ing, [field]: field === 'quantity' ? parseFloat(value as string) || 0 : value }
        : ing
    ));
  };

  // Handle category change to enable/disable pizza mode
  const handleCategoryChange = (category: string) => {
    setNewRecipeCategory(category);
    
    if (category === 'pizza') {
      setIsPizzaMode(true);
      setIsCalzoneMode(false);
      
      // Initialize with basic pizza sections
      setNewIngredients([
        { itemId: '', quantity: 0, tempId: 'dough-1', section: 'dough' },
        { itemId: '', quantity: 0, tempId: 'sauce-1', section: 'sauce' },
        { itemId: '', quantity: 0, tempId: 'topping-1', section: 'toppings' }
      ]);
    } else {
      // Reset to regular mode
      setIsPizzaMode(false);
      setIsCalzoneMode(false);
      setNewIngredients([{ itemId: '', quantity: 0, tempId: 'temp-1', section: 'other' }]);
      setSelectedPizzaSize('');
      setSelectedCalzoneSize('');
      setSelectedPizzaType('standard');
    }
  };

  // Ingredient management for edit mode
  const handleAddEditIngredient = () => {
    setEditIngredients([...editIngredients, { itemId: '', quantity: 0, tempId: `temp-${Date.now()}` }]);
  };

  const handleRemoveEditIngredient = (index: number) => {
    const ingredient = editIngredients[index];
    
    if (ingredient.id) {
      setDeletedIngredientIds([...deletedIngredientIds, ingredient.id]);
    }
    
    setEditIngredients(editIngredients.filter((_, i) => i !== index));
  };

  const handleEditIngredientChange = (index: number, field: string, value: string) => {
    const updatedIngredients = [...editIngredients];
    updatedIngredients[index] = {
      ...updatedIngredients[index],
      [field]: field === 'quantity' ? parseFloat(value) || 0 : value
    };
    setEditIngredients(updatedIngredients);
  };

  // Form validation
  const isCreateFormValid = () => {
    if (!newRecipeName.trim()) return false;
    const validIngredients = newIngredients.filter(ing => ing.itemId && ing.quantity > 0);
    return validIngredients.length > 0;
  };

  const isEditFormValid = () => {
    if (!editRecipeName.trim()) return false;
    const validIngredients = editIngredients.filter(ing => ing.itemId && ing.quantity > 0);
    return validIngredients.length > 0;
  };

  // Form submission
  const handleCreateRecipe = () => {
    if (!isCreateFormValid()) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    const validIngredients = newIngredients.filter(ing => ing.itemId && ing.quantity > 0);
    
    const recipeData: CreateRecipeParams = {
      recipe: {
        name: newRecipeName,
        description: newRecipeDescription,
      },
      ingredients: validIngredients.map(ingredient => ({
        itemId: ingredient.itemId,
        quantity: ingredient.quantity
      }))
    };
    
    createRecipe(recipeData);
    resetCreateForm();
  };

  const handleUpdateRecipe = () => {
    if (!isEditFormValid() || !selectedRecipe) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    const validIngredients = editIngredients.filter(ing => ing.itemId && ing.quantity > 0);
    
    const recipeData: UpdateRecipeParams = {
      recipeId: selectedRecipe.id,
      recipe: {
        name: editRecipeName,
        description: editRecipeDescription,
      },
      ingredients: validIngredients,
      deletedIngredientIds
    };
    
    updateRecipe(recipeData);
  };

  const handleDeleteRecipe = (recipeId: string, recipeName: string) => {
    if (confirm(`Are you sure you want to delete "${recipeName}"? This action cannot be undone.`)) {
      deleteRecipe(recipeId);
    }
  };

  // Form reset functions
  const resetCreateForm = () => {
    setNewRecipeName('');
    setNewRecipeCategory('');
    setNewRecipeDescription('');
    setNewIngredients([{ itemId: '', quantity: 0, tempId: 'temp-1', section: 'other' }]);
    setActiveStep(1);
    setIsCreateMode(false);
    setIsPizzaMode(false);
    setIsCalzoneMode(false);
    setSelectedPizzaSize('');
    setSelectedCalzoneSize('');
    setSelectedPizzaType('standard');
  };

  const resetEditForm = () => {
    setEditRecipeName('');
    setEditRecipeDescription('');
    setEditIngredients([]);
    setDeletedIngredientIds([]);
  };

  const handleEditRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setEditRecipeName(recipe.name);
    setEditRecipeDescription(recipe.description || '');
    setEditIngredients(recipe.ingredients.map((ing, index) => ({
      ...ing,
      tempId: ing.id || `temp-${index}`
    })));
    setDeletedIngredientIds([]);
    setIsEditRecipeDialogOpen(true);
  };

  // Handler for opening recipe details popup
  const handleRecipeCardClick = (recipe) => {
    setSelectedRecipeForDetails(recipe);
    setIsRecipeDetailsOpen(true);
    setIsEditingInDetails(false);
    
    // Pre-populate edit form in case user wants to edit
    setEditRecipeName(recipe.name);
    setEditRecipeDescription(recipe.description || '');
    setEditIngredients(recipe.ingredients.map((ing, index) => ({
      ...ing,
      tempId: ing.id || `temp-${index}`
    })));
    setDeletedIngredientIds([]);
  };

  // Handler for starting edit mode within details dialog
  const handleStartEditingInDetails = () => {
    setIsEditingInDetails(true);
  };

  // Handler for canceling edit mode in details dialog
  const handleCancelEditInDetails = () => {
    setIsEditingInDetails(false);
    // Reset form to original values
    if (selectedRecipeForDetails) {
      setEditRecipeName(selectedRecipeForDetails.name);
      setEditRecipeDescription(selectedRecipeForDetails.description || '');
      setEditIngredients(selectedRecipeForDetails.ingredients.map((ing, index) => ({
        ...ing,
        tempId: ing.id || `temp-${index}`
      })));
      setDeletedIngredientIds([]);
    }
  };

  // Handler for saving changes from details dialog
  const handleSaveFromDetails = () => {
    if (!isEditFormValid() || !selectedRecipeForDetails) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    const validIngredients = editIngredients.filter(ing => ing.itemId && ing.quantity > 0);
    
    const recipeData: UpdateRecipeParams = {
      recipeId: selectedRecipeForDetails.id,
      recipe: {
        name: editRecipeName,
        description: editRecipeDescription,
      },
      ingredients: validIngredients,
      deletedIngredientIds
    };
    
    updateRecipe(recipeData);
    setIsEditingInDetails(false);
  };

  const calculateTotalCost = (ingredients: any[]) => {
    return ingredients.reduce((total, ing) => {
      if (ing.inventory_item && ing.quantity) {
        return total + (ing.inventory_item.cost_per_unit * ing.quantity);
      }
      return total;
    }, 0);
  };

  const getIngredientItem = (itemId: string) => {
    return inventoryItems.find(item => item.id === itemId);
  };

  // Function to update existing pizza recipes with new dough amounts
  const updateExistingRecipes = async (newDoughConfig: PizzaSize[]) => {
    try {
      // Find all pizza and calzone recipes that contain dough ingredients
      const relevantRecipes = recipes.filter(recipe => 
        recipe.name.toLowerCase().includes('pizza') ||
        recipe.name.toLowerCase().includes('calzone') ||
        recipe.ingredients.some(ing => 
          inventoryItems.find(item => 
            item.id === ing.itemId && 
            (item.name.toLowerCase().includes('dough') || item.name.toLowerCase().includes('flour'))
          )
        )
      );

      if (relevantRecipes.length === 0) {
        return;
      }

      // For each recipe, try to determine size and type, then update dough amount
      for (const recipe of relevantRecipes) {
        const recipeName = recipe.name.toLowerCase();
        
        if (recipeName.includes('calzone')) {
          // Handle calzone recipes
          const matchedCalzoneSize = activeCalzoneDoughConfig.find(size => 
            recipeName.includes(getCalzoneName(size).toLowerCase())
          );

          if (matchedCalzoneSize) {
            // Find dough ingredient in recipe
            const doughIngredient = recipe.ingredients.find(ing => {
              const item = inventoryItems.find(item => item.id === ing.itemId);
              return item && (
                item.name.toLowerCase().includes('dough') || 
                item.name.toLowerCase().includes('flour')
              );
            });

            if (doughIngredient) {
              const newDoughAmount = getCalzoneDoughAmount(matchedCalzoneSize);

              // Update the recipe ingredient if amount has changed
              if (doughIngredient.quantity !== newDoughAmount) {
                const updatedIngredients = recipe.ingredients.map(ing => 
                  ing.id === doughIngredient.id 
                    ? { ...ing, quantity: newDoughAmount }
                    : ing
                );

                // Update recipe in database
                await updateRecipe({
                  recipeId: recipe.id,
                  recipe: {
                    name: recipe.name,
                    description: recipe.description
                  },
                  ingredients: updatedIngredients,
                  deletedIngredientIds: []
                });
              }
            }
          }
        } else {
          // Handle pizza recipes (existing logic)
          const matchedSize = newDoughConfig.find(size => 
            recipeName.includes(getPizzaName(size).toLowerCase())
          );
          
          // Try to match pizza type from recipe name
          const matchedType = PIZZA_TYPES.find(type => 
            recipeName.includes(type.name.toLowerCase())
          );

          if (matchedSize && matchedType) {
            // Find dough ingredient in recipe
            const doughIngredient = recipe.ingredients.find(ing => {
              const item = inventoryItems.find(item => item.id === ing.itemId);
              return item && (
                item.name.toLowerCase().includes('dough') || 
                item.name.toLowerCase().includes('flour')
              );
            });

            if (doughIngredient) {
              // Calculate new dough amount
              const newDoughAmount = getPizzaDoughAmount(matchedSize, matchedType.id === 'thin_crust' ? 'thin_crust' : 'standard');

              // Update the recipe ingredient if amount has changed
              if (doughIngredient.quantity !== newDoughAmount) {
                const updatedIngredients = recipe.ingredients.map(ing => 
                  ing.id === doughIngredient.id 
                    ? { ...ing, quantity: newDoughAmount }
                    : ing
                );

                // Update recipe in database
                await updateRecipe({
                  recipeId: recipe.id,
                  recipe: {
                    name: recipe.name,
                    description: recipe.description
                  },
                  ingredients: updatedIngredients,
                  deletedIngredientIds: []
                });
              }
            }
          }
        }
      }

      toast.success(`Updated ${relevantRecipes.length} pizza/calzone recipes with new dough amounts`);
    } catch (error) {
      console.error('Error updating existing recipes:', error);
      toast.error('Failed to update some existing recipes');
    }
  };

  // Tag management helper functions
  const resetTagForm = () => {
    setNewTagName('');
    setNewTagCategory('flavor');
    setNewTagColor('#3B82F6');
    setNewTagDescription('');
    setSelectedTagForEdit(null);
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) {
      toast.error('Tag name is required');
      return;
    }

    createTag({
      name: newTagName.trim(),
      category: newTagCategory,
      color: newTagColor,
      description: newTagDescription.trim() || undefined
    });

    resetTagForm();
    setIsCreateTagOpen(false);
  };

  const handleEditTag = () => {
    if (!selectedTagForEdit || !newTagName.trim()) {
      toast.error('Tag name is required');
      return;
    }

    updateTag({
      id: selectedTagForEdit.id,
      name: newTagName.trim(),
      color: newTagColor,
      description: newTagDescription.trim() || undefined
    });

    resetTagForm();
    setIsEditTagOpen(false);
  };

  const handleDeleteTag = (tagId: string) => {
    if (confirm('Are you sure you want to delete this tag? This will remove it from all recipes.')) {
      deleteTag(tagId);
    }
  };

  const openEditTag = (tag: RecipeTag) => {
    setSelectedTagForEdit(tag);
    setNewTagName(tag.name);
    setNewTagCategory(tag.category);
    setNewTagColor(tag.color);
    setNewTagDescription(tag.description || '');
    setIsEditTagOpen(true);
  };

  const openAssignTag = (recipeId: string) => {
    setSelectedRecipeForTagging(recipeId);
    setIsAssignTagOpen(true);
  };

  const handleAssignTag = (tagId: string) => {
    if (selectedRecipeForTagging) {
      assignTag({ recipeId: selectedRecipeForTagging, tagId });
    }
  };

  const handleRemoveTag = (recipeId: string, tagId: string) => {
    removeTag({ recipeId, tagId });
  };

  // Get available colors for tags
  const TAG_COLORS = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  // Function to update recipes based on tags when dough configuration changes
  const updateRecipesByTags = async (sizeTag: string, typeTag: string | null, newDoughAmount: number) => {
    try {
      // Find the NYP Dough ingredient
      const nypDoughIngredient = inventoryItems.find(item => 
        item.name.toLowerCase().includes('nyp dough') || 
        item.name.toLowerCase() === 'nyp dough'
      );

      if (!nypDoughIngredient) {
        toast.error('NYP Dough ingredient not found in inventory');
        return;
      }

      // Find recipes that have the matching tags
      const matchingRecipes = recipes.filter(recipe => {
        if (!recipe.tags || recipe.tags.length === 0) return false;
        
        const recipeSizeTag = recipe.tags.find(tag => tag.category === 'size');
        const recipeTypeTag = recipe.tags.find(tag => tag.category === 'type');
        
        // Must have matching size tag
        const hasMatchingSize = recipeSizeTag && recipeSizeTag.name === sizeTag;
        
        // For pizza: must have matching type tag OR no type requirement for calzones
        const hasMatchingType = typeTag ? 
          (recipeTypeTag && recipeTypeTag.name === typeTag) : 
          true; // For calzones, we don't check type
        
        return hasMatchingSize && hasMatchingType;
      });

      if (matchingRecipes.length === 0) {
        toast.info(`No recipes found with tags: ${sizeTag}${typeTag ? ` + ${typeTag}` : ''}`);
        return;
      }

      // Update each matching recipe
      let updatedCount = 0;
      let addedCount = 0;
      
      for (const recipe of matchingRecipes) {
        // Find the dough ingredient in this recipe
        const doughIngredient = recipe.ingredients?.find(item => 
          item.inventory_item?.name?.toLowerCase().includes('nyp dough') ||
          item.inventory_item?.name?.toLowerCase() === 'nyp dough'
        );

        let updatedIngredients;

        if (doughIngredient) {
          // Update existing dough ingredient
          updatedIngredients = recipe.ingredients.map(item => 
            item.id === doughIngredient.id 
              ? { ...item, quantity: newDoughAmount }
              : item
          );
          updatedCount++;
        } else {
          // Add NYP Dough ingredient to the recipe
          updatedIngredients = [
            ...recipe.ingredients,
            {
              itemId: nypDoughIngredient.id,
              quantity: newDoughAmount,
              inventory_item: nypDoughIngredient
            }
          ];
          addedCount++;
        }

        // Update the recipe in database
        await updateRecipe({
          recipeId: recipe.id,
          recipe: {
            name: recipe.name,
            description: recipe.description
          },
          ingredients: updatedIngredients,
          deletedIngredientIds: []
        });
      }

      // Provide detailed feedback
      const messages = [];
      if (updatedCount > 0) {
        messages.push(`Updated ${updatedCount} recipes`);
      }
      if (addedCount > 0) {
        messages.push(`Added NYP Dough to ${addedCount} recipes`);
      }

      toast.success(`${messages.join(' and ')} with dough amount: ${newDoughAmount}g for ${sizeTag}${typeTag ? ` ${typeTag}` : ''}`);
    } catch (error) {
      console.error('Error updating recipes by tags:', error);
      toast.error('Failed to update some recipes');
    }
  };

  // Handle saving dough configuration with tag-based updates
  const handleSaveDoughConfig = async () => {
    try {
      // Update pizza dough config
      for (let i = 0; i < editingPizzaConfig.length; i++) {
        const config = editingPizzaConfig[i];
        const originalConfig = activePizzaDoughConfig[i];
        
        const standardDough = getPizzaDoughAmount(config, 'standard');
        const thinCrustDough = getPizzaDoughAmount(config, 'thin_crust');
        const originalStandardDough = getPizzaDoughAmount(originalConfig, 'standard');
        const originalThinCrustDough = getPizzaDoughAmount(originalConfig, 'thin_crust');
        
        // Check if standard dough amount changed
        if (standardDough !== originalStandardDough) {
          await updateRecipesByTags(getPizzaName(config), 'Standard', standardDough);
        }
        
        // Check if thin crust dough amount changed
        if (thinCrustDough !== originalThinCrustDough) {
          await updateRecipesByTags(getPizzaName(config), 'Thin Crust', thinCrustDough);
        }
      }

      // Update calzone dough config
      for (let i = 0; i < editingCalzoneConfig.length; i++) {
        const config = editingCalzoneConfig[i];
        const originalConfig = activeCalzoneDoughConfig[i];
        
        const doughAmount = getCalzoneDoughAmount(config);
        const originalDoughAmount = getCalzoneDoughAmount(originalConfig);
        
        // Check if calzone dough amount changed
        if (doughAmount !== originalDoughAmount) {
          await updateRecipesByTags(getCalzoneName(config), null, doughAmount);
        }
      }

      // Save to database
      await updatePizzaDoughConfig(editingPizzaConfig);
      await updateCalzoneDoughConfig(editingCalzoneConfig);
      
      setIsDoughConfigOpen(false);
      toast.success('Dough configuration saved and recipes updated!');
    } catch (error) {
      console.error('Error saving dough configuration:', error);
      toast.error('Failed to save dough configuration');
    }
  };

  if (isLoadingRecipes || isLoadingItems) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading recipes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              <ChefHat className="mr-3 h-8 w-8 text-primary" />
              Recipe Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Create and manage recipes for menu items with intelligent ingredient tracking.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsDoughConfigOpen(true)}
              className="flex items-center"
            >
              <Settings className="mr-2 h-4 w-4" />
              Configure Dough
            </Button>
            <Button variant="outline" size="sm">
              <FileDown className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button 
              size="sm" 
              onClick={() => setIsCreateMode(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Recipe
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Filters and Search */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="flex flex-col space-y-4 md:flex-row md:space-x-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="md:w-[300px]"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {RECIPE_CATEGORIES.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Tag Filter Button */}
          <DropdownMenu open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2">
                <Filter className="h-4 w-4" />
                <span>Filter by Tags</span>
                {(selectedSizeTags.length + selectedTypeTags.length + selectedFlavorTags.length) > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedSizeTags.length + selectedTypeTags.length + selectedFlavorTags.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-4" align="start">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filter by Tags</h4>
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    Clear All
                  </Button>
                </div>

                <Separator />

                {/* Size Tags */}
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-muted-foreground">Size</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {availableSizeTags.map((tag) => (
                      <div key={tag.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`size-${tag.id}`}
                          checked={selectedSizeTags.includes(tag.id)}
                          onCheckedChange={(checked) => handleTagFilter('size', tag.id, checked as boolean)}
                        />
                        <label
                          htmlFor={`size-${tag.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          <Badge variant="outline" className="text-xs" style={{ borderColor: tag.color }}>
                            {tag.name}
                          </Badge>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Type Tags */}
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-muted-foreground">Type</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {availableTypeTags.map((tag) => (
                      <div key={tag.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`type-${tag.id}`}
                          checked={selectedTypeTags.includes(tag.id)}
                          onCheckedChange={(checked) => handleTagFilter('type', tag.id, checked as boolean)}
                        />
                        <label
                          htmlFor={`type-${tag.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          <Badge variant="outline" className="text-xs" style={{ borderColor: tag.color }}>
                            {tag.name}
                          </Badge>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Flavor Tags */}
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-muted-foreground">Flavors</h5>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {availableFlavorTags.map((tag) => (
                      <div key={tag.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`flavor-${tag.id}`}
                          checked={selectedFlavorTags.includes(tag.id)}
                          onCheckedChange={(checked) => handleTagFilter('flavor', tag.id, checked as boolean)}
                        />
                        <label
                          htmlFor={`flavor-${tag.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          <Badge variant="outline" className="text-xs" style={{ borderColor: tag.color }}>
                            {tag.name}
                          </Badge>
                        </label>
                      </div>
              ))}
                  </div>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="px-3 py-1">
            {filteredRecipes.length} recipes
          </Badge>
        </div>
      </div>

      {/* Recipe Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredRecipes.map((recipe) => {
          const totalCost = calculateTotalCost(recipe.ingredients);
          const categoryInfo = RECIPE_CATEGORIES.find(cat => cat.id === selectedCategory) || RECIPE_CATEGORIES[0];
          
          return (
            <Card 
              key={recipe.id} 
              className="overflow-hidden hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20 cursor-pointer"
              onClick={() => handleRecipeCardClick(recipe)}
            >
              <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1.5 rounded-lg ${categoryInfo.color}`}>
                        <categoryInfo.icon className="h-4 w-4 text-white" />
                      </div>
                      <CardTitle className="text-lg">{recipe.name}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <Package className="h-3 w-3 mr-1" />
                    {recipe.ingredients.length} ingredients
                      </div>
                      <div className="flex items-center">
                        <Calculator className="h-3 w-3 mr-1" />
                        PKR {totalCost.toFixed(2)}
                      </div>
                    </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={(e) => e.stopPropagation()} // Prevent card click when clicking menu
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      handleRecipeCardClick(recipe);
                    }}>
                      <BookOpen className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      handleEditRecipe(recipe);
                    }}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Recipe
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate Recipe
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRecipe(recipe.id, recipe.name);
                        }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Recipe
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {recipe.description || 'No description provided'}
                </p>
                
                <div className="space-y-3">
                  {/* Recipe Tags */}
                  {recipe.tags && recipe.tags.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center">
                        <Tags className="h-3 w-3 mr-1" />
                        Tags:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {recipe.tags.map((tag) => (
                          <Badge 
                            key={tag.id} 
                            variant="outline" 
                            className="text-xs px-2 py-1"
                            style={{ 
                              borderColor: tag.color,
                              color: tag.color,
                              backgroundColor: `${tag.color}10`
                            }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium mb-2">Key Ingredients:</p>
                    <div className="flex flex-wrap gap-1">
                      {recipe.ingredients.slice(0, 3).map((ingredient) => {
                        const item = ingredient.inventory_item;
                        return item ? (
                          <Badge key={ingredient.id} variant="secondary" className="text-xs">
                            {item.name}
                          </Badge>
                        ) : null;
                      })}
                      {recipe.ingredients.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{recipe.ingredients.length - 3} more
                        </Badge>
                  )}
              </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      Updated {new Date(recipe.updated_at).toLocaleDateString()}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {categoryInfo.name}
                    </Badge>
                  </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Add New Recipe Card */}
        <Card 
        className="flex flex-col items-center justify-center min-h-[280px] border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/25 transition-all duration-200 cursor-pointer group"
        onClick={() => setIsCreateMode(true)}
        >
        <div className="flex flex-col items-center text-muted-foreground group-hover:text-primary transition-colors">
          <div className="p-4 rounded-full bg-muted group-hover:bg-primary/10 transition-colors mb-4">
            <Plus className="h-8 w-8" />
          </div>
          <p className="font-medium text-lg">Create New Recipe</p>
          <p className="text-sm mt-1 text-center px-4">
            Design your culinary masterpiece with our intuitive recipe builder
          </p>
          </div>
        </Card>
      </div>

      {/* Recipe Details Dialog */}
      {selectedRecipeForDetails && (
        <Dialog open={isRecipeDetailsOpen} onOpenChange={setIsRecipeDetailsOpen}>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-semibold flex items-center">
                <ChefHat className="mr-3 h-6 w-6 text-primary" />
                {selectedRecipeForDetails.name}
              </DialogTitle>
              <p className="text-muted-foreground">
                {isEditingInDetails ? 'Edit recipe details and ingredients' : 'View recipe details and ingredients'}
              </p>
          </DialogHeader>
            
            <div className="space-y-6">
              {!isEditingInDetails ? (
                // View Mode
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Recipe Information */}
                    <Card className="p-4">
                      <h4 className="font-medium text-lg mb-3 flex items-center">
                        <BookOpen className="h-5 w-5 mr-2 text-primary" />
                        Recipe Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name:</span>
                          <span className="font-medium">{selectedRecipeForDetails.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Category:</span>
                          <span className="font-medium">
                            {RECIPE_CATEGORIES.find(cat => cat.id === 'pizza')?.name || 'General'}
                          </span>
                        </div>
                        {selectedRecipeForDetails.description && (
                          <div className="pt-2 border-t">
                            <span className="text-muted-foreground">Description:</span>
                            <p className="mt-1">{selectedRecipeForDetails.description}</p>
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* Cost Summary */}
                    <Card className="p-4">
                      <h4 className="font-medium text-lg mb-3 flex items-center">
                        <Calculator className="h-5 w-5 mr-2 text-primary" />
                        Cost Summary
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Total Ingredients:</span>
                          <Badge variant="outline">{selectedRecipeForDetails.ingredients.length}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Total Cost:</span>
                          <Badge className="bg-green-500 hover:bg-green-600">
                            PKR {calculateTotalCost(selectedRecipeForDetails.ingredients).toFixed(2)}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Last Updated:</span>
                          <span>{new Date(selectedRecipeForDetails.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Ingredients List */}
                  <Card className="p-4">
                    <h4 className="font-medium text-lg mb-4 flex items-center">
                      <Package className="h-5 w-5 mr-2 text-primary" />
                      Ingredients ({selectedRecipeForDetails.ingredients.length})
                    </h4>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {selectedRecipeForDetails.ingredients.map((ingredient, index) => {
                        const item = ingredient.inventory_item;
                        if (!item) return null;
                        
                        return (
                          <div 
                            key={ingredient.id || index} 
                            className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                              <span className="font-medium">{item.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {safeGetBaseUnitDisplayName(item.base_unit, item.unit_type)}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {ingredient.quantity} {safeGetBaseUnitDisplayName(item.base_unit, item.unit_type)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                PKR {(item.cost_per_unit * ingredient.quantity).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </>
              ) : (
                // Edit Mode
                <div className="space-y-6">
                  {/* Basic Information */}
                  <Card className="p-4">
                    <h4 className="font-medium text-lg mb-4">Edit Recipe Information</h4>
              <div className="grid grid-cols-1 gap-4">
                <div>
                        <label className="text-sm font-medium">Recipe Name *</label>
                  <Input 
                    placeholder="Enter recipe name" 
                          className="mt-2" 
                          value={editRecipeName}
                          onChange={(e) => setEditRecipeName(e.target.value)}
                        />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                        <Textarea 
                  placeholder="Enter description" 
                          className="mt-2" 
                          rows={3}
                          value={editRecipeDescription}
                          onChange={(e) => setEditRecipeDescription(e.target.value)}
                />
              </div>
                    </div>
                  </Card>

                  {/* Ingredients */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-lg">Edit Ingredients</h4>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          Total Cost: PKR {calculateTotalCost(editIngredients).toFixed(2)}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Quantities are in the ingredient stock unit (g, ml, pcs) — not crates or purchase packs.
                      If milk is tracked in ml, enter 200 for 200 ml, not 0.2 liters.
                    </p>
                    
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {editIngredients.map((ingredient, index) => {
                        const item = ingredient.inventory_item;
                        return (
                          <Card key={ingredient.tempId || index} className="p-4 card-hover">
                            <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-6">
                            <Select 
                              value={ingredient.itemId} 
                                  onValueChange={(value) => handleEditIngredientChange(index, 'itemId', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select ingredient" />
                              </SelectTrigger>
                              <SelectContent>
                                {inventoryItems.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                        <div className="flex items-center justify-between w-full">
                                          <span>{item.name}</span>
                                          <Badge variant="outline" className="ml-2">
                                            {safeGetBaseUnitDisplayName(item.base_unit, item.unit_type)}
                                          </Badge>
                                        </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                              <div className="col-span-4">
                                <div className="flex items-center space-x-2">
                              <Input 
                                type="number" 
                                placeholder="0" 
                                min="0"
                                step="0.01"
                                    value={ingredient.quantity || ''}
                                    onChange={(e) => handleEditIngredientChange(index, 'quantity', e.target.value)}
                              />
                                  <span className="text-sm text-muted-foreground min-w-[40px]">
                                    {item ? safeGetBaseUnitDisplayName(item.base_unit, item.unit_type) : ''}
                              </span>
                            </div>
                                {item && ingredient.quantity > 0 && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Cost: PKR {(item.cost_per_unit * ingredient.quantity).toFixed(2)}
                                  </p>
                                )}
                          </div>
                              <div className="col-span-2 flex justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                                  onClick={() => handleRemoveEditIngredient(index)}
                                  className="text-destructive hover:text-destructive"
                            >
                                  <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                          </Card>
                        );
                      })}
                      
                      <Button 
                        variant="outline" 
                        onClick={handleAddEditIngredient}
                        className="w-full"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Ingredient
                      </Button>
                    </div>
                </Card>
              </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              <div className="flex justify-between w-full">
                <Button variant="outline" onClick={() => setIsRecipeDetailsOpen(false)}>
                  Close
              </Button>
                <div className="flex space-x-2">
                  {!isEditingInDetails ? (
                    <Button onClick={handleStartEditingInDetails}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Recipe
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={handleCancelEditInDetails}>
                        Cancel Edit
                      </Button>
                      <Button 
                        onClick={handleSaveFromDetails} 
                        disabled={isUpdatingRecipe || !isEditFormValid()}
                      >
                        {isUpdatingRecipe ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                  </>
                ) : (
                          'Save Changes'
                )}
              </Button>
                    </>
                  )}
                </div>
              </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* Create Recipe Dialog */}
      {/* [All the existing create recipe dialog code would go here] */}

      {/* Edit Recipe Dialog */}
      {/* [All the existing edit recipe dialog code would go here] */}

      {/* Dough Configuration Dialog */}
      <Dialog open={isDoughConfigOpen} onOpenChange={setIsDoughConfigOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
            <DialogTitle className="flex items-center">
              <Wheat className="mr-2 h-5 w-5" />
              Configure Dough
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Update dough amounts for different pizza sizes and types. Changes will automatically update recipes with matching tags.
            </p>
            </DialogHeader>
          <div className="space-y-6">
            <Tabs defaultValue="pizza" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pizza">Pizza Dough</TabsTrigger>
                <TabsTrigger value="calzone">Calzone Dough</TabsTrigger>
              </TabsList>
              
              <TabsContent value="pizza" className="space-y-4">
                <div className="text-sm text-muted-foreground mb-4">
                  Configure dough amounts (in grams) for each pizza size and crust type.
                </div>
                <div className="space-y-3">
                  {editingPizzaConfig.map((size, index) => (
                    <div key={getPizzaId(size)} className="p-4 border rounded-lg bg-secondary/10">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className="px-3 py-1">
                          {getPizzaName(size)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Standard Crust (grams)</label>
                    <Input 
                            type="number"
                            value={getPizzaDoughAmount(size, 'standard')}
                            onChange={(e) => updateEditingPizzaConfig(index, 'standard', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="1"
                            className="text-right"
                    />
                  </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Thin Crust (grams)</label>
                  <Input 
                            type="number"
                            value={getPizzaDoughAmount(size, 'thin_crust')}
                            onChange={(e) => updateEditingPizzaConfig(index, 'thin_crust', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="1"
                            className="text-right"
                  />
                </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="calzone" className="space-y-4">
                <div className="text-sm text-muted-foreground mb-4">
                  Configure dough amounts (in grams) for each calzone size.
                </div>
                <div className="space-y-3">
                  {editingCalzoneConfig.map((size, index) => (
                    <div key={getCalzoneId(size)} className="p-4 border rounded-lg bg-secondary/10">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="px-3 py-1">
                          {getCalzoneName(size)}
                        </Badge>
                        <div className="space-y-2 w-48">
                          <label className="text-sm font-medium">Dough Amount (grams)</label>
                                  <Input 
                                    type="number" 
                            value={getCalzoneDoughAmount(size)}
                            onChange={(e) => updateEditingCalzoneConfig(index, parseFloat(e.target.value) || 0)}
                                    min="0"
                            step="1"
                            className="text-right"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Note:</strong> Changing dough amounts will automatically update all recipes that have matching size and type tags. 
                The system will look for "NYP Dough" ingredient in those recipes and update the quantities.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDoughConfigOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDoughConfig} disabled={isDoughConfigUpdating}>
              {isDoughConfigUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Management Dialog */}
      <Dialog open={isTagManagementOpen} onOpenChange={setIsTagManagementOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {(['size', 'type', 'flavor'] as TagCategory[]).map((category) => (
              <div key={category} className="space-y-3">
                <h3 className="text-lg font-semibold capitalize">{category} Tags</h3>
                <div className="grid gap-2">
                  {getTagsByCat(category).map((tag) => (
                    <div key={tag.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant="outline" 
                          style={{ 
                            borderColor: tag.color,
                            color: tag.color,
                            backgroundColor: `${tag.color}10`
                          }}
                        >
                          {tag.name}
                        </Badge>
                        {tag.description && (
                          <span className="text-sm text-muted-foreground">
                            {tag.description}
                                  </span>
                        )}
                                </div>
                      <div className="flex items-center space-x-2">
                                <Button 
                                  variant="ghost" 
                          size="sm"
                          onClick={() => openEditTag(tag)}
                                >
                          <Edit3 className="h-4 w-4" />
                                </Button>
                        <Button 
                          variant="ghost"
                          size="sm" 
                          onClick={() => handleDeleteTag(tag.id)}
                          disabled={isDeletingTag}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                </div>
                  ))}
              </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Tag Dialog */}
      <Dialog open={isCreateTagOpen} onOpenChange={setIsCreateTagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Tag Name</label>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Enter tag name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select value={newTagCategory} onValueChange={(value) => setNewTagCategory(value as TagCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="size">Size</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="flavor">Flavor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 ${newTagColor === color ? 'border-gray-400' : 'border-gray-200'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Textarea
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
                placeholder="Enter description"
                rows={3}
              />
            </div>
          </div>
              <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTagOpen(false)}>
                  Cancel
                </Button>
            <Button onClick={handleCreateTag} disabled={isCreatingTag}>
              {isCreatingTag ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Tag
                </Button>
              </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={isEditTagOpen} onOpenChange={setIsEditTagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Tag Name</label>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Enter tag name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Input value={newTagCategory} disabled className="bg-muted" />
            </div>
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 ${newTagColor === color ? 'border-gray-400' : 'border-gray-200'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Textarea
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
                placeholder="Enter description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTagOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditTag} disabled={isUpdatingTag}>
              {isUpdatingTag ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Tag Dialog */}
      <Dialog open={isAssignTagOpen} onOpenChange={setIsAssignTagOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Recipe Tags</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {(['size', 'type', 'flavor'] as TagCategory[]).map((category) => (
              <div key={category} className="space-y-3">
                <h3 className="text-lg font-semibold capitalize">{category} Tags</h3>
                <div className="grid grid-cols-2 gap-2">
                  {getTagsByCat(category).map((tag) => {
                    const recipe = recipes.find(r => r.id === selectedRecipeForTagging);
                    const isAssigned = recipe?.tags?.some(t => t.id === tag.id);
                    
                    return (
                      <button
                        key={tag.id}
                        className={`p-2 border rounded-lg text-left transition-colors ${
                          isAssigned 
                            ? 'border-primary bg-primary/10' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => {
                          if (isAssigned) {
                            handleRemoveTag(selectedRecipeForTagging!, tag.id);
                          } else {
                            handleAssignTag(tag.id);
                          }
                        }}
                      >
                        <Badge 
                          variant="outline" 
                          className={`${isAssigned ? 'opacity-100' : 'opacity-70'}`}
                          style={{ 
                            borderColor: tag.color,
                            color: tag.color,
                            backgroundColor: `${tag.color}10`
                          }}
                        >
                          {tag.name}
                          {isAssigned && <Check className="h-3 w-3 ml-1" />}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsAssignTagOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Recipes;
