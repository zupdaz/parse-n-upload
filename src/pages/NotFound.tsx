
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <AppLayout className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
      <div className="text-center space-y-4 animate-fade-in">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <p className="text-xl text-muted-foreground max-w-md mx-auto">
          We can't seem to find the page you're looking for.
        </p>
        <div className="pt-6">
          <Button asChild>
            <a href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Home
            </a>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default NotFound;
