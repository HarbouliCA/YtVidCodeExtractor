import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Home, LayoutDashboard } from "lucide-react";

export function Navbar() {
  return (
    <nav className="border-b bg-background">
      <div className="container flex h-16 items-center px-4">
        {/* Logo */}
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <span className="text-xl font-bold">CodeSnippet</span>
        </Link>
        
        {/* Navigation Links */}
        <div className="flex-1 flex justify-end items-center space-x-4">
          <div className="hidden md:flex items-center space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
            </Button>
          </div>
          
          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="h-5 w-5" />
              </Link>
            </Button>
          </div>

          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </nav>
  );
}
