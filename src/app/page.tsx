import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between px-4 container mx-auto">
        <div className="font-semibold text-lg">CodeSnippet</div>
        <nav className="flex gap-4">
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">Get Started</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1 container mx-auto flex flex-col items-center justify-center gap-6 py-20 text-center">
        <h1 className="text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl">
          Learn to Code with{" "}
          <span className="text-primary">AI-Powered</span> Video Analysis
        </h1>
        
        <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
          Transform any coding tutorial into an interactive learning experience. 
          Get real-time code snippets and explanations synchronized with your video.
        </p>

        <div className="flex gap-4">
          <Button size="lg" asChild>
            <Link href="/sign-up">Start Learning</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/about">Learn More</Link>
          </Button>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold">AI Video Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Automatically extract code from video frames
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold">Smart Transcription</h3>
            <p className="text-sm text-muted-foreground">
              Convert video explanations to text
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold">Code Generation</h3>
            <p className="text-sm text-muted-foreground">
              Get context-aware code snippets
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold">Synchronized Learning</h3>
            <p className="text-sm text-muted-foreground">
              Code updates as you watch
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}