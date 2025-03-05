
import { ReactNode } from "react";
import { ThemeProvider } from "@/hooks/use-theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  return (
    <ThemeProvider defaultTheme="system">
      <div className="relative min-h-screen bg-background font-sans antialiased">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center">
            <div className="flex flex-1 items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="relative z-20 flex items-center text-lg font-medium">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2 h-6 w-6"
                  >
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                    <path d="M10 12v6" />
                    <path d="M14 16v2" />
                    <path d="M6 12v1" />
                  </svg>
                  FileParser
                </div>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className={cn("container py-6 md:py-10", className)}>
          {children}
        </main>
        <footer className="border-t py-6 md:py-0">
          <div className="container flex h-14 items-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} FileParser. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
