import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <nav className="border-b bg-background">
      <div className="flex h-16 items-center px-4 container mx-auto">
        <Link href="/" className="font-semibold text-lg">
          CodeSnippet
        </Link>
        
        <div className="flex items-center gap-4 ml-auto">
          <Button variant="ghost" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </nav>
  );
}
