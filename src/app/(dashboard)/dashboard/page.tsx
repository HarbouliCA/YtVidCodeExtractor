import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold">Your Tutorials</h1>
        <Button asChild>
          <Link href="/analyze" className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Add Tutorial
          </Link>
        </Button>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-full text-center py-12 text-muted-foreground">
          No tutorials yet. Click "Add Tutorial" to get started!
        </div>
      </div>
    </div>
  );
}
