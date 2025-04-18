import React from 'react';
import { BarChart3, Construction } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Reports = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            View and generate system reports and analytics
          </p>
        </div>
      </div>

      <Card className="border-dashed border-2 border-primary/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-primary/10">
              <Construction className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">This Feature is Coming Soon</CardTitle>
          <CardDescription className="text-lg">
            The Reports module is currently under development
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground max-w-md mx-auto">
            We're working hard to bring you powerful reporting tools for your inventory management needs. 
            Check back soon for updates.
          </p>
          
          <div className="grid gap-4 md:grid-cols-2 max-w-lg mx-auto">
            <Card className="p-4 flex items-center space-x-4">
              <div className="p-2 rounded-full bg-secondary">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Sales Reports</h3>
                <p className="text-sm text-muted-foreground">Track revenue trends over time</p>
              </div>
            </Card>
            
            <Card className="p-4 flex items-center space-x-4">
              <div className="p-2 rounded-full bg-secondary">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Inventory Usage</h3>
                <p className="text-sm text-muted-foreground">Monitor inventory consumption</p>
              </div>
            </Card>
          </div>
          
          <Button variant="outline" onClick={() => window.history.back()}>
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports; 