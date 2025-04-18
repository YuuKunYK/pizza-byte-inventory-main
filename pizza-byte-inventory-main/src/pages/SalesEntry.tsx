import React from 'react';
import { FileSpreadsheet, Construction, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SalesEntry = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Entry</h1>
          <p className="text-muted-foreground">
            Record and manage your daily sales data
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
            The Sales Entry module is currently under development
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground max-w-md mx-auto">
            We're building a comprehensive sales tracking system to help you manage your daily sales data and 
            automatically calculate inventory usage. This feature will be available soon.
          </p>
          
          <div className="grid gap-4 md:grid-cols-2 max-w-lg mx-auto">
            <Card className="p-4 flex items-center space-x-4">
              <div className="p-2 rounded-full bg-secondary">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Daily Sales</h3>
                <p className="text-sm text-muted-foreground">Record product sales by quantity</p>
              </div>
            </Card>
            
            <Card className="p-4 flex items-center space-x-4">
              <div className="p-2 rounded-full bg-secondary">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Auto Inventory Tracking</h3>
                <p className="text-sm text-muted-foreground">Automatic inventory adjustments</p>
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

export default SalesEntry; 