import React, { useState } from 'react';
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
  Loader2
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
import { useRecipes } from '@/hooks/useRecipes';
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
  deletedIngredientIds: string[];
}

const Recipes = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeCategory, setNewRecipeCategory] = useState('pizza');
  const [newRecipeDescription, setNewRecipeDescription] = useState('');
  const [newIngredients, setNewIngredients] = useState([{ itemId: '', quantity: '' }]);
  
  const [editRecipeName, setEditRecipeName] = useState('');
  const [editRecipeCategory, setEditRecipeCategory] = useState('');
  const [editRecipeDescription, setEditRecipeDescription] = useState('');
  const [editIngredients, setEditIngredients] = useState<any[]>([]);
  const [deletedIngredientIds, setDeletedIngredientIds] = useState<string[]>([]);

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

  const categories = [
    { id: 'pizza', name: 'Pizza' },
    { id: 'sides', name: 'Sides' },
    { id: 'desserts', name: 'Desserts' },
    { id: 'beverages', name: 'Beverages' },
  ];

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          recipe.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all';
    
    return matchesSearch && matchesCategory;
  });

  const handleAddIngredient = () => {
    setNewIngredients([...newIngredients, { itemId: '', quantity: '' }]);
  };

  const handleRemoveIngredient = (index: number) => {
    setNewIngredients(newIngredients.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (index: number, field: string, value: string) => {
    const updatedIngredients = [...newIngredients];
    updatedIngredients[index] = {
      ...updatedIngredients[index],
      [field]: value
    };
    setNewIngredients(updatedIngredients);
  };

  const handleAddEditIngredient = () => {
    setEditIngredients([...editIngredients, { itemId: '', quantity: '' }]);
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
      [field]: field === 'quantity' ? parseFloat(value) : value
    };
    setEditIngredients(updatedIngredients);
  };

  const handleCreateRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newRecipeName) {
      toast.error('Please enter a recipe name');
      return;
    }
    
    const validIngredients = newIngredients.filter(
      ingredient => ingredient.itemId && parseFloat(ingredient.quantity) > 0
    );
    
    if (validIngredients.length === 0) {
      toast.error('Please add at least one ingredient with a valid quantity');
      return;
    }
    
    const recipeData: CreateRecipeParams = {
      recipe: {
        name: newRecipeName,
        description: newRecipeDescription,
      },
      ingredients: validIngredients.map(ingredient => ({
        itemId: ingredient.itemId,
        quantity: parseFloat(ingredient.quantity)
      }))
    };
    
    createRecipe(recipeData);
    
    resetCreateForm();
  };

  const handleUpdateRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editRecipeName || !selectedRecipe) {
      toast.error('Please enter a recipe name');
      return;
    }
    
    const validIngredients = editIngredients.filter(
      ingredient => ingredient.itemId && ingredient.quantity > 0
    );
    
    if (validIngredients.length === 0) {
      toast.error('Please add at least one ingredient with a valid quantity');
      return;
    }
    
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

  const handleDeleteRecipe = (recipeId: string) => {
    if (confirm('Are you sure you want to delete this recipe?')) {
      deleteRecipe(recipeId);
    }
  };

  const resetCreateForm = () => {
    setNewRecipeName('');
    setNewRecipeCategory('pizza');
    setNewRecipeDescription('');
    setNewIngredients([{ itemId: '', quantity: '' }]);
  };

  const handleEditRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setEditRecipeName(recipe.name);
    setEditRecipeDescription(recipe.description || '');
    setEditIngredients(recipe.ingredients.map(ing => ({
      id: ing.id,
      itemId: ing.itemId,
      quantity: ing.quantity
    })));
    setDeletedIngredientIds([]);
    setIsEditRecipeDialogOpen(true);
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
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Recipe Management</h1>
        <p className="text-muted-foreground">
          Create and manage recipes for menu items and inventory deduction.
        </p>
      </div>

      <Separator />

      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="flex flex-col space-y-4 md:flex-row md:space-x-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="md:w-[250px]"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10">
                <Filter className="mr-2 h-4 w-4" />
                {selectedCategory === 'all' 
                  ? 'All Categories' 
                  : categories.find(cat => cat.id === selectedCategory)?.name || 'Filter'
                }
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSelectedCategory('all')}>
                All Categories
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {categories.map((category) => (
                <DropdownMenuItem
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" size="sm" className="h-10">
            <FileDown className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="h-10">
            <FileUp className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button size="sm" className="h-10" onClick={() => setIsAddRecipeDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Recipe
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredRecipes.map((recipe) => (
          <Card key={recipe.id} className="overflow-hidden card-hover">
            <CardHeader className="border-b border-border pb-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="flex items-center">
                    <Pizza className="h-5 w-5 mr-2 text-pizza" />
                    {recipe.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {recipe.ingredients.length} ingredients
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
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
                      className="text-red-500"
                      onClick={() => handleDeleteRecipe(recipe.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Recipe
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-sm mb-4">{recipe.description}</p>
              <div className="space-y-2">
                <p className="text-sm font-medium">Ingredients:</p>
                <ul className="text-sm space-y-1">
                  {recipe.ingredients.slice(0, 4).map((ingredient) => (
                    <li key={ingredient.id} className="flex justify-between">
                      <span>{ingredient.name}</span>
                      <span className="text-muted-foreground">
                        {ingredient.quantity} {ingredient.unit}
                      </span>
                    </li>
                  ))}
                  {recipe.ingredients.length > 4 && (
                    <li className="text-muted-foreground text-xs">
                      +{recipe.ingredients.length - 4} more
                    </li>
                  )}
                </ul>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                Last updated: {new Date(recipe.updated_at).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))}

        <Card 
          className="flex flex-col items-center justify-center min-h-[300px] border-dashed card-hover cursor-pointer"
          onClick={() => setIsAddRecipeDialogOpen(true)}
        >
          <div className="flex flex-col items-center text-muted-foreground">
            <Plus className="h-12 w-12 mb-4" />
            <p className="font-medium">Add New Recipe</p>
            <p className="text-sm mt-1">Define ingredients and quantities</p>
          </div>
        </Card>
      </div>

      <Dialog 
        open={isAddRecipeDialogOpen} 
        onOpenChange={(open) => {
          setIsAddRecipeDialogOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Recipe</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRecipe}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-sm font-medium">Recipe Name</label>
                  <Input 
                    placeholder="Enter recipe name" 
                    className="mt-1" 
                    value={newRecipeName}
                    onChange={(e) => setNewRecipeName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select value={newRecipeCategory} onValueChange={setNewRecipeCategory}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input 
                  placeholder="Enter description" 
                  className="mt-1" 
                  value={newRecipeDescription}
                  onChange={(e) => setNewRecipeDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Ingredients</label>
                <Card>
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      {newIngredients.map((ingredient, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-6">
                            <Select 
                              value={ingredient.itemId} 
                              onValueChange={(value) => handleIngredientChange(index, 'itemId', value)}
                              required
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select ingredient" />
                              </SelectTrigger>
                              <SelectContent>
                                {inventoryItems.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name} ({item.unit_type})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-5">
                            <div className="flex items-center">
                              <Input 
                                type="number" 
                                placeholder="0" 
                                min="0"
                                step="0.01"
                                value={ingredient.quantity}
                                onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)}
                                required
                              />
                              <span className="ml-2">
                                {ingredient.itemId && inventoryItems.find(item => item.id === ingredient.itemId)?.unit_type}
                              </span>
                            </div>
                          </div>
                          <div className="col-span-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              type="button"
                              onClick={() => handleRemoveIngredient(index)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2 w-full"
                        type="button"
                        onClick={handleAddIngredient}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Ingredient
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setIsAddRecipeDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingRecipe}>
                {isCreatingRecipe ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Save Recipe'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {selectedRecipe && (
        <Dialog open={isEditRecipeDialogOpen} onOpenChange={setIsEditRecipeDialogOpen}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Edit Recipe</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateRecipe}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-sm font-medium">Recipe Name</label>
                    <Input 
                      placeholder="Enter recipe name" 
                      className="mt-1" 
                      value={editRecipeName}
                      onChange={(e) => setEditRecipeName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input 
                    placeholder="Enter description" 
                    className="mt-1" 
                    value={editRecipeDescription}
                    onChange={(e) => setEditRecipeDescription(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Ingredients</label>
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ingredient</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editIngredients.map((ingredient, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Select 
                                  value={ingredient.itemId} 
                                  onValueChange={(value) => handleEditIngredientChange(index, 'itemId', value)}
                                  required
                                >
                                  <SelectTrigger className="border-none">
                                    <SelectValue placeholder="Select ingredient" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {inventoryItems.map((item) => (
                                      <SelectItem key={item.id} value={item.id}>
                                        {item.name} ({item.unit_type})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center">
                                  <Input 
                                    type="number" 
                                    className="w-20 h-8" 
                                    min="0"
                                    step="0.01"
                                    value={ingredient.quantity}
                                    onChange={(e) => handleEditIngredientChange(index, 'quantity', e.target.value)}
                                    required
                                  />
                                  <span className="ml-2">
                                    {ingredient.itemId && inventoryItems.find(item => item.id === ingredient.itemId)?.unit_type}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  type="button"
                                  onClick={() => handleRemoveEditIngredient(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="p-4">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          type="button"
                          onClick={handleAddEditIngredient}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Ingredient
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsEditRecipeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdatingRecipe}>
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
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Recipes;
