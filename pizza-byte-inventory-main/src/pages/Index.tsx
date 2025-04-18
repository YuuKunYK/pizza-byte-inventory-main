
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to dashboard
    navigate("/");
  }, [navigate]);

  // Loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold">Loading The New York Pizza Inventory System...</h1>
      </div>
    </div>
  );
};

export default Index;
