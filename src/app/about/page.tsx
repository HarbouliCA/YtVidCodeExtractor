import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check } from "lucide-react";

const features = [
  {
    title: "AI Video Analysis",
    description: "Automatically extract code from video frames using advanced AI",
  },
  {
    title: "Smart Transcription",
    description: "Convert video explanations to searchable text using OpenAI Whisper",
  },
  {
    title: "Code Generation",
    description: "Get context-aware code snippets synchronized with video playback",
  },
  {
    title: "Multi-Language Support",
    description: "Support for multiple programming languages and frameworks",
  },
  {
    title: "Interactive Learning",
    description: "Code along with the video in real-time",
  },
  {
    title: "Smart Bookmarks",
    description: "Save and organize important code segments",
  },
];

const tiers = [
  {
    name: "Free",
    price: "€0",
    description: "Perfect for occasional learning",
    features: [
      "5 videos per month",
      "Basic code extraction",
      "Standard transcription",
      "Community support",
      "Basic code snippets",
      "48-hour processing time",
    ],
    cta: "Get Started",
    href: "/sign-up",
  },
  {
    name: "Pro",
    price: "€5",
    period: "/month",
    description: "For dedicated developers",
    features: [
      "Unlimited videos",
      "Priority processing",
      "Advanced code extraction",
      "Premium transcription quality",
      "Custom code explanations",
      "Code playground access",
      "Priority support",
      "1-hour processing time",
    ],
    cta: "Upgrade to Pro",
    href: "/sign-up?plan=pro",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For teams and organizations",
    features: [
      "Everything in Pro",
      "Custom API access",
      "Team collaboration",
      "Advanced analytics",
      "Custom integrations",
      "Dedicated support",
      "Training sessions",
      "SLA guarantees",
    ],
    cta: "Contact Sales",
    href: "/contact",
  },
];

const faqs = [
  {
    question: "How does CodeSnippet work?",
    answer: "CodeSnippet uses advanced AI to analyze video tutorials, extract code snippets, and synchronize them with the video playback. It transcribes the audio, recognizes code in video frames, and provides an interactive learning experience.",
  },
  {
    question: "What programming languages are supported?",
    answer: "We support all major programming languages including JavaScript, Python, Java, C++, Ruby, and more. Our AI is trained to recognize and format code in various languages and frameworks.",
  },
  {
    question: "Can I use my own video tutorials?",
    answer: "Yes! You can upload any coding tutorial video or provide a YouTube URL. Our system will process it and create an interactive learning experience with synchronized code snippets.",
  },
  {
    question: "How long does video processing take?",
    answer: "Processing time varies by plan. Free tier users can expect processing within 48 hours, while Pro users get priority processing within 1 hour. Enterprise users receive immediate processing.",
  },
];

const testimonials = [
  {
    quote: "CodeSnippet has revolutionized how I learn from coding tutorials. The synchronized code snippets are incredibly helpful!",
    author: "Sarah Chen",
    title: "Full Stack Developer",
  },
  {
    quote: "The AI-powered code extraction is amazing. It saves me so much time when following along with tutorials.",
    author: "Michael Johnson",
    title: "Software Engineer",
  },
  {
    quote: "Perfect for our team's training needs. The enterprise features have greatly improved our onboarding process.",
    author: "Emily Rodriguez",
    title: "Engineering Manager",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-12 px-4">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-4">
            Transform Video Tutorials into
            <span className="text-primary"> Interactive Code</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            CodeSnippet uses AI to analyze coding videos and generate synchronized
            code snippets, making learning to code more interactive and efficient.
          </p>
        </div>

        {/* Features Grid */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything you need to learn effectively
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="border-2">
                <CardHeader>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Pricing Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">
            Simple, transparent pricing
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier) => (
              <Card
                key={tier.name}
                className={`flex flex-col justify-between border-2 ${
                  tier.featured ? "border-primary" : ""
                }`}
              >
                <CardHeader>
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription className="text-lg">
                    {tier.description}
                  </CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    {tier.period && (
                      <span className="text-muted-foreground">{tier.period}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-8"
                    variant={tier.featured ? "default" : "outline"}
                    asChild
                  >
                    <Link href={tier.href}>{tier.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="grid gap-6 max-w-3xl mx-auto">
            {faqs.map((faq) => (
              <Card key={faq.question}>
                <CardHeader>
                  <CardTitle className="text-xl">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Testimonials Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">
            Loved by developers
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.quote}>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground mb-4">{testimonial.quote}</p>
                  <div className="font-semibold">{testimonial.author}</div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.title}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-20">
          <h2 className="text-3xl font-bold mb-4">
            Ready to enhance your learning?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of developers learning more effectively with CodeSnippet.
          </p>
          <Button size="lg" asChild>
            <Link href="/sign-up">Get Started for Free</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}