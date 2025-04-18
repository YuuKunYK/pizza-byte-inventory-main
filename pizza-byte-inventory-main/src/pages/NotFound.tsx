
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChefHat, Home } from "lucide-react";

const NotFound = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="space-y-6 max-w-md">
        <ChefHat className="mx-auto h-24 w-24 text-pizza" />
        <h1 className="text-4xl font-bold tracking-tight">404 - Page Not Found</h1>
        <p className="text-muted-foreground">
          Oops! Looks like this page has been eaten by a hungry customer. Let's go back to the kitchen.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/" className="flex items-center">
            <Home className="mr-2 h-5 w-5" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
