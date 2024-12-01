import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function AnalyzePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Analyze Video</h1>
        <p className="text-muted-foreground">
          Paste a YouTube URL to start extracting code snippets
        </p>
      </div>

      {/* URL Input Section */}
      <div className="max-w-2xl mb-8">
        <div className="flex gap-4">
          <Input
            type="url"
            placeholder="Paste YouTube URL here..."
            className="flex-1"
          />
          <Button>Analyze</Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video Preview */}
        <Card className="lg:sticky lg:top-4 h-fit">
          <CardContent className="p-4">
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">
                Video preview will appear here
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <h2 className="font-semibold text-xl">Video Title</h2>
              <p className="text-muted-foreground text-sm">
                Video description will appear here
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Code Snippets Section */}
        <div className="space-y-4">
          <Tabs defaultValue="snippets" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="snippets" className="flex-1">
                Code Snippets
              </TabsTrigger>
              <TabsTrigger value="transcript" className="flex-1">
                Transcript
              </TabsTrigger>
            </TabsList>
            <TabsContent value="snippets">
              <Card>
                <CardContent className="p-4 min-h-[400px] space-y-4">
                  <div className="rounded-lg bg-muted p-4">
                    <pre className="text-sm">
                      <code>
                        // Code snippets will appear here
                        // as the video is processed
                      </code>
                    </pre>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Copy
                    </Button>
                    <Button variant="outline" size="sm">
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="transcript">
              <Card>
                <CardContent className="p-4 min-h-[400px]">
                  <p className="text-muted-foreground">
                    Video transcript will appear here
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
