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
  Wheat
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
import { useRecipes } from '@/hooks/useRecipes';
import { toast } from '@/components/ui/sonner';
import { getBaseUnitDisplayName } from '@/types/inventory';

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
  defaultDough: number; // in grams
}

interface PizzaType {
  id: string;
  name: string;
  doughMultiplier: number; // multiplier for dough amount
}

const PIZZA_SIZES: PizzaSize[] = [
  { id: '7inch', name: '7 inch', defaultDough: 150 },
  { id: '9inch', name: '9 inch', defaultDough: 200 },
  { id: '12inch', name: '12 inch', defaultDough: 300 },
  { id: '16inch', name: '16 inch', defaultDough: 450 },
  { id: '16inch_half', name: '16 inch Half', defaultDough: 225 },
  { id: '21inch', name: '21 inch', defaultDough: 650 },
  { id: '21inch_half', name: '21 inch Half', defaultDough: 325 },
  { id: '21inch_slice', name: '21 inch Slice', defaultDough: 85 },
];

const PIZZA_TYPES: PizzaType[] = [
  { id: 'standard', name: 'Standard', doughMultiplier: 1.0 },
  { id: 'thin_crust', name: 'Thin Crust', doughMultiplier: 0.75 },
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
  const [isPizzaMode, setIsPizzaMode] = useState(false);
  
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
  
  // Dough configuration state (would typically come from settings/database)
  const [doughConfig, setDoughConfig] = useState(PIZZA_SIZES);

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
    isDeletingRecipe
  } = useRecipes();

  // Filter and search logic
  const filteredRecipes = useMemo(() => {
    return recipes.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            recipe.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || selectedCategory === newRecipeCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [recipes, searchQuery, selectedCategory, newRecipeCategory]);

  const filteredInventoryItems = useMemo(() => {
    return inventoryItems.filter(item => 
      item.name.toLowerCase().includes(ingredientSearchQuery.toLowerCase())
    );
  }, [inventoryItems, ingredientSearchQuery]);

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
    
    const size = PIZZA_SIZES.find(s => s.id === sizeId);
    const type = PIZZA_TYPES.find(t => t.id === selectedPizzaType);
    
    if (size && type) {
      const doughAmount = Math.round(size.defaultDough * type.doughMultiplier);
      
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
      
      // Update recipe name if it's empty or default
      if (!newRecipeName || newRecipeName.includes('Pizza')) {
        setNewRecipeName(`${size.name} ${type.name} Pizza`);
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
    setIsPizzaMode(category === 'pizza');
    
    if (category === 'pizza') {
      // Initialize with basic pizza sections
      setNewIngredients([
        { itemId: '', quantity: 0, tempId: 'dough-1', section: 'dough' },
        { itemId: '', quantity: 0, tempId: 'sauce-1', section: 'sauce' },
        { itemId: '', quantity: 0, tempId: 'topping-1', section: 'toppings' }
      ]);
    } else {
      // Reset to regular mode
      setNewIngredients([{ itemId: '', quantity: 0, tempId: 'temp-1', section: 'other' }]);
      setSelectedPizzaSize('');
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
    setSelectedPizzaSize('');
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

  const calculateTotalCost = (ingredients: any[]) => {
    return ingredients.reduce((total, ing) => {
      const item = inventoryItems.find(item => item.id === ing.itemId);
      if (item && ing.quantity) {
        return total + (item.cost_per_unit * ing.quantity);
      }
      return total;
    }, 0);
  };

  const getIngredientItem = (itemId: string) => {
    return inventoryItems.find(item => item.id === itemId);
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
            <Card key={recipe.id} className="overflow-hidden hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20">
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
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditRecipe(recipe)}>
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
                        onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
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
                  <div>
                    <p className="text-sm font-medium mb-2">Key Ingredients:</p>
                    <div className="flex flex-wrap gap-1">
                      {recipe.ingredients.slice(0, 3).map((ingredient) => (
                        <Badge key={ingredient.id} variant="secondary" className="text-xs">
                          {ingredient.name}
                        </Badge>
                      ))}
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

      {/* Create Recipe Dialog */}
      <Dialog open={isCreateMode} onOpenChange={(open) => {
        setIsCreateMode(open);
        if (!open) resetCreateForm();
      }}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl font-bold flex items-center">
              <ChefHat className="mr-3 h-6 w-6 text-primary" />
              Create New Recipe
            </DialogTitle>
            <p className="text-muted-foreground">
              Follow the steps below to create your recipe
            </p>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="flex items-center justify-center space-x-4 py-4 bg-muted/30 rounded-lg mb-6">
            {[
              { num: 1, label: 'Basic Info', icon: BookOpen },
              { num: 2, label: 'Ingredients', icon: Package },
              { num: 3, label: 'Review', icon: Check }
            ].map((step, index) => (
              <div key={step.num} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                  activeStep === step.num 
                    ? 'bg-primary text-white' 
                    : activeStep > step.num 
                    ? 'bg-green-500 text-white' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {activeStep > step.num ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span className="ml-2 text-sm font-medium">{step.label}</span>
                {index < 2 && (
                  <div className={`w-8 h-0.5 mx-4 transition-colors ${
                    activeStep > step.num ? 'bg-green-500' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>

          <div className="space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Step 1: Basic Information */}
            {activeStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Recipe Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Recipe Name *</label>
                    <Input 
                      placeholder="Enter a delicious recipe name" 
                      className="mt-2" 
                      value={newRecipeName}
                      onChange={(e) => setNewRecipeName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Category</label>
                    <Select value={newRecipeCategory} onValueChange={handleCategoryChange}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {RECIPE_CATEGORIES.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <div className="flex items-center">
                              <category.icon className="mr-2 h-4 w-4" />
                              {category.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Pizza-specific configuration */}
                {isPizzaMode && (
                  <div className="mt-6 p-4 bg-secondary/30 border border-secondary rounded-lg">
                    <div className="flex items-center mb-4">
                      <Pizza className="h-5 w-5 mr-2 text-primary" />
                      <h4 className="font-medium text-foreground">Pizza Configuration</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-foreground">Pizza Size</label>
                        <Select value={selectedPizzaSize} onValueChange={handlePizzaSizeChange}>
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Select pizza size" />
                          </SelectTrigger>
                          <SelectContent>
                            {PIZZA_SIZES.map((size) => (
                              <SelectItem key={size.id} value={size.id}>
                                {size.name} ({size.defaultDough}g dough base)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground">Pizza Type</label>
                        <Select value={selectedPizzaType} onValueChange={handlePizzaTypeChange}>
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Select pizza type" />
                          </SelectTrigger>
                          <SelectContent>
                            {PIZZA_TYPES.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name} ({Math.round(type.doughMultiplier * 100)}% dough)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {selectedPizzaSize && selectedPizzaType && (
                      <div className="mt-3 p-3 bg-muted/50 rounded border">
                        <p className="text-sm text-foreground">
                          <strong>Calculated Dough:</strong> {
                            Math.round(
                              (PIZZA_SIZES.find(s => s.id === selectedPizzaSize)?.defaultDough || 0) * 
                              (PIZZA_TYPES.find(t => t.id === selectedPizzaType)?.doughMultiplier || 1)
                            )
                          } grams
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea 
                    placeholder="Describe your recipe..." 
                    className="mt-2" 
                    rows={3}
                    value={newRecipeDescription}
                    onChange={(e) => setNewRecipeDescription(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Ingredients */}
            {activeStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Recipe Ingredients</h3>
                  <div className="flex items-center space-x-2">
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Total Cost: PKR {calculateTotalCost(newIngredients).toFixed(2)}
                    </span>
                  </div>
                </div>

                {!isPizzaMode && (
                  <div className="mb-4">
                    <Input
                      placeholder="Search ingredients..."
                      value={ingredientSearchQuery}
                      onChange={(e) => setIngredientSearchQuery(e.target.value)}
                      className="w-full"
                    />
                  </div>
                )}

                <div className="space-y-6 max-h-[500px] overflow-y-auto">
                  {isPizzaMode ? (
                    // Pizza mode - sectioned ingredients
                    <div className="space-y-6">
                      {INGREDIENT_SECTIONS.map((section) => {
                        const sectionIngredients = ingredientsBySection[section.id] || [];
                        
                        return (
                          <div key={section.id} className={`p-4 rounded-lg border-2 ${section.color}`}>
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center">
                                <section.icon className="h-5 w-5 mr-2" />
                                <h4 className="font-medium">{section.name}</h4>
                                <Badge variant="outline" className="ml-2">
                                  {sectionIngredients.length}
                                </Badge>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddIngredient(section.id)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add {section.name}
                              </Button>
                            </div>
                            
                            <div className="space-y-3">
                              {sectionIngredients.map((ingredient) => {
                                const item = getIngredientItem(ingredient.itemId);
                                return (
                                  <Card key={ingredient.tempId} className="p-3 bg-background border-muted card-hover">
                                    <div className="grid grid-cols-12 gap-3 items-center">
                                      <div className="col-span-6">
                                        <Select 
                                          value={ingredient.itemId} 
                                          onValueChange={(value) => handleIngredientChange(ingredient.tempId!, 'itemId', value)}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder={`Select ${section.name.toLowerCase()}`} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {(section.id === 'sauce' ? sauceIngredients : 
                                              section.id === 'dough' ? doughIngredients : 
                                              filteredInventoryItems).map((item) => (
                                              <SelectItem key={item.id} value={item.id}>
                                                <div className="flex items-center justify-between w-full">
                                                  <span>{item.name}</span>
                                                  <Badge variant="outline" className="ml-2">
                                                    {item.base_unit ? getBaseUnitDisplayName(item.base_unit) : item.unit_type}
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
                                            onChange={(e) => handleIngredientChange(ingredient.tempId!, 'quantity', e.target.value)}
                                            disabled={section.id === 'dough' && !!selectedPizzaSize} // Disable if auto-calculated
                                          />
                                          <span className="text-sm text-muted-foreground min-w-[40px]">
                                            {item ? (item.base_unit ? getBaseUnitDisplayName(item.base_unit) : item.unit_type) : ''}
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
                                          onClick={() => handleRemoveIngredient(ingredient.tempId!)}
                                          className="text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                              
                              {sectionIngredients.length === 0 && (
                                <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded">
                                  <section.icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">No {section.name.toLowerCase()} added yet</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Regular mode - simple ingredient list
                    <div className="space-y-3">
                      {newIngredients.map((ingredient) => {
                        const item = getIngredientItem(ingredient.itemId);
                        return (
                          <Card key={ingredient.tempId} className="p-4 card-hover">
                            <div className="grid grid-cols-12 gap-4 items-center">
                              <div className="col-span-6">
                                <Select 
                                  value={ingredient.itemId} 
                                  onValueChange={(value) => handleIngredientChange(ingredient.tempId!, 'itemId', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select ingredient" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {filteredInventoryItems.map((item) => (
                                      <SelectItem key={item.id} value={item.id}>
                                        <div className="flex items-center justify-between w-full">
                                          <span>{item.name}</span>
                                          <Badge variant="outline" className="ml-2">
                                            {item.base_unit ? getBaseUnitDisplayName(item.base_unit) : item.unit_type}
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
                                    onChange={(e) => handleIngredientChange(ingredient.tempId!, 'quantity', e.target.value)}
                                  />
                                  <span className="text-sm text-muted-foreground min-w-[40px]">
                                    {item ? (item.base_unit ? getBaseUnitDisplayName(item.base_unit) : item.unit_type) : ''}
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
                                  onClick={() => handleRemoveIngredient(ingredient.tempId!)}
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
                        onClick={() => handleAddIngredient()}
                        className="w-full"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Another Ingredient
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {activeStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Review Your Recipe</h3>
                
                <Card className="p-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium">Recipe Details</h4>
                      <div className="mt-2 space-y-1 text-sm">
                        <p><strong>Name:</strong> {newRecipeName}</p>
                        <p><strong>Category:</strong> {RECIPE_CATEGORIES.find(cat => cat.id === newRecipeCategory)?.name}</p>
                        {isPizzaMode && selectedPizzaSize && (
                          <>
                            <p><strong>Pizza Size:</strong> {PIZZA_SIZES.find(s => s.id === selectedPizzaSize)?.name}</p>
                            <p><strong>Pizza Type:</strong> {PIZZA_TYPES.find(t => t.id === selectedPizzaType)?.name}</p>
                          </>
                        )}
                        {newRecipeDescription && (
                          <p><strong>Description:</strong> {newRecipeDescription}</p>
                        )}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">Ingredients ({newIngredients.filter(ing => ing.itemId && ing.quantity > 0).length})</h4>
                        <Badge variant="outline">
                          Total: PKR {calculateTotalCost(newIngredients).toFixed(2)}
                        </Badge>
                      </div>
                      
                      {isPizzaMode ? (
                        // Pizza mode - show by sections
                        <div className="space-y-4">
                          {INGREDIENT_SECTIONS.map((section) => {
                            const sectionIngredients = newIngredients
                              .filter(ing => ing.section === section.id && ing.itemId && ing.quantity > 0);
                            
                            if (sectionIngredients.length === 0) return null;
                            
                            return (
                              <div key={section.id} className="border rounded p-3 bg-secondary/30">
                                <div className="flex items-center mb-2">
                                  <section.icon className="h-4 w-4 mr-2" />
                                  <h5 className="font-medium">{section.name}</h5>
                                </div>
                                <div className="space-y-1">
                                  {sectionIngredients.map((ingredient) => {
                                    const item = getIngredientItem(ingredient.itemId);
                                    if (!item) return null;
                                    
                                    return (
                                      <div key={ingredient.tempId} className="flex justify-between items-center py-1 px-2 bg-background/80 rounded text-sm">
                                        <span>{item.name}</span>
                                        <div className="text-right">
                                          <div>
                                            {ingredient.quantity} {item.base_unit ? getBaseUnitDisplayName(item.base_unit) : item.unit_type}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            PKR {(item.cost_per_unit * ingredient.quantity).toFixed(2)}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        // Regular mode - simple list
                        <div className="space-y-2">
                          {newIngredients
                            .filter(ing => ing.itemId && ing.quantity > 0)
                            .map((ingredient) => {
                              const item = getIngredientItem(ingredient.itemId);
                              if (!item) return null;
                              
                              return (
                                <div key={ingredient.tempId} className="flex justify-between items-center py-2 px-3 bg-background/80 rounded">
                                  <span className="font-medium">{item.name}</span>
                                  <div className="text-right">
                                    <div className="text-sm">
                                      {ingredient.quantity} {item.base_unit ? getBaseUnitDisplayName(item.base_unit) : item.unit_type}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      PKR {(item.cost_per_unit * ingredient.quantity).toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          }
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {!isCreateFormValid() && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Please ensure you have entered a recipe name and at least one ingredient with a valid quantity.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between mt-6">
            <div className="flex space-x-2">
              {activeStep > 1 && (
                <Button 
                  variant="outline" 
                  onClick={() => setActiveStep(activeStep - 1)}
                >
                  Previous
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsCreateMode(false)}>
                Cancel
              </Button>
            </div>
            
            <div className="flex space-x-2">
              {activeStep < 3 ? (
                <Button 
                  onClick={() => setActiveStep(activeStep + 1)}
                  disabled={activeStep === 1 && !newRecipeCategory}
                >
                  Next
                </Button>
              ) : (
                <Button 
                  onClick={handleCreateRecipe}
                  disabled={isCreatingRecipe || !isCreateFormValid()}
                >
                  {isCreatingRecipe ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Recipe...
                    </>
                  ) : (
                    'Create Recipe'
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Recipe Dialog */}
      {selectedRecipe && (
        <Dialog open={isEditRecipeDialogOpen} onOpenChange={(open) => {
          setIsEditRecipeDialogOpen(open);
          if (!open) resetEditForm();
        }}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-semibold">Edit Recipe</DialogTitle>
              <p className="text-muted-foreground">
                Update your recipe details and ingredients
              </p>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">Recipe Information</h3>
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
              </div>

              {/* Ingredients */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-lg font-medium">Ingredients</h3>
                  <Badge variant="outline">
                    Total Cost: PKR {calculateTotalCost(editIngredients).toFixed(2)}
                  </Badge>
                </div>
                
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {editIngredients.map((ingredient, index) => {
                    const item = getIngredientItem(ingredient.itemId);
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
                                        {item.base_unit ? getBaseUnitDisplayName(item.base_unit) : item.unit_type}
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
                                {item ? (item.base_unit ? getBaseUnitDisplayName(item.base_unit) : item.unit_type) : ''}
                              </span>
                            </div>
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
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setIsEditRecipeDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateRecipe} 
                disabled={isUpdatingRecipe || !isEditFormValid()}
              >
                {isUpdatingRecipe ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Recipe'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dough Configuration Dialog */}
      <Dialog open={isDoughConfigOpen} onOpenChange={setIsDoughConfigOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-semibold flex items-center">
              <Wheat className="mr-3 h-6 w-6 text-amber-600" />
              Configure Dough Amounts
            </DialogTitle>
            <p className="text-muted-foreground">
              Set the default dough amounts for different pizza sizes and types
            </p>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Pizza Size Dough Amounts</h3>
              <div className="space-y-3">
                {doughConfig.map((size, index) => (
                  <div key={size.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Pizza className="h-5 w-5 text-red-500" />
                      <span className="font-medium">{size.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={size.defaultDough}
                        onChange={(e) => {
                          const newConfig = [...doughConfig];
                          newConfig[index] = {
                            ...newConfig[index],
                            defaultDough: parseInt(e.target.value) || 0
                          };
                          setDoughConfig(newConfig);
                        }}
                        className="w-20"
                        min="0"
                      />
                      <span className="text-sm text-muted-foreground">grams</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-medium mb-4">Pizza Type Multipliers</h3>
              <div className="space-y-3">
                {PIZZA_TYPES.map((type) => (
                  <div key={type.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Wheat className="h-5 w-5 text-amber-600" />
                      <span className="font-medium">{type.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{Math.round(type.doughMultiplier * 100)}%</span>
                      <Badge variant="outline" className="text-xs">
                        {type.doughMultiplier === 1.0 ? 'Standard' : 'Modified'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Multipliers adjust the base dough amount. Thin crust uses 75% of standard dough.
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Changes will apply to new pizza recipes. Existing recipes will not be affected automatically.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsDoughConfigOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              // Here you would typically save to database/settings
              toast.success('Dough configuration saved successfully');
              setIsDoughConfigOpen(false);
            }}>
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Recipes;
