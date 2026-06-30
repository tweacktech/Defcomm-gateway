import { Head, Link } from '@inertiajs/react';
import { register, login } from '@/routes';
import { Shield, Lock, Zap, Globe, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Props = {
  status?: string;
  canRegister: boolean;
};

export default function Welcome({ status, canRegister }: Props) {
  return (
    <>
      <Head title="Welcome to Defcomm" />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform group-hover:scale-105">
                  <Shield className="h-5 w-5" />
                </div>
                <span className="text-xl font-bold text-foreground">
                  Defcomm
                </span>
              </Link>

              <div className="flex items-center gap-3">
                <Button variant="ghost" asChild>
                  <Link href={login()}>Log in</Link>
                </Button>
                {canRegister && (
                  <Button asChild>
                    <Link href={register()} className="inline-flex items-center gap-2">
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-slate-100 [mask-image:radial-gradient(ellipse_at_center,white,transparent)] dark:bg-grid-slate-800" />
          <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
            <div className="max-w-4xl mx-auto text-center">
              <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm gap-2">
                <Shield className="h-4 w-4" />
                Defense-Grade Communication
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                Welcome to{' '}
                <span className="text-primary">
                  Defcomm
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                A modern defense-grade communication platform built for speed,
                reliability, and secure collaboration. Stay connected. Stay protected.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button size="lg" asChild className="gap-2">
                  <Link href={register()}>
                    Start Free Trial
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="#features">Learn More</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 lg:py-24 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
                Why Choose{' '}
                <span className="text-primary">
                  Defcomm
                </span>
                ?
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need for secure, real-time communication at scale.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                {
                  icon: Lock,
                  title: 'Secure Communication',
                  description: 'End-to-end encrypted channels for safe conversations.',
                },
                {
                  icon: Zap,
                  title: 'Real-Time Interaction',
                  description: 'Ultra-fast messaging and video communication powered by WebRTC.',
                },
                {
                  icon: Globe,
                  title: 'Scalable Infrastructure',
                  description: 'Built to scale with your organization\'s needs.',
                },
              ].map((feature, index) => (
                <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <CardHeader>
                    <div className="inline-flex rounded-lg bg-primary/10 p-3 text-primary mb-2">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm text-muted-foreground">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Auth Section */}
        <section className="py-16 lg:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
            <Card>
              <CardHeader>
                <CardTitle className="text-center">Get Started</CardTitle>
                <CardDescription className="text-center">
                  Secure • Intelligent • Real-time Communication
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-between h-auto py-4" asChild>
                  <Link href={login()}>
                    <div className="text-left">
                      <div className="font-medium">Log in</div>
                      <div className="text-xs text-muted-foreground">Already have an account</div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                </Button>

                {canRegister && (
                  <Button variant="outline" className="w-full justify-between h-auto py-4" asChild>
                    <Link href={register()}>
                      <div className="text-left">
                        <div className="font-medium">Create an account</div>
                        <div className="text-xs text-muted-foreground">New to Defcomm?</div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                  </Button>
                )}

                {status && (
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-center text-sm font-medium text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50">
                    <CheckCircle className="h-4 w-4 inline mr-2" />
                    {status}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">Defcomm</span>
                <span className="text-muted-foreground">© {new Date().getFullYear()}</span>
              </div>
              <div className="flex items-center gap-6 text-muted-foreground">
                <Link href="#" className="hover:text-foreground transition-colors">
                  Privacy
                </Link>
                <Link href="#" className="hover:text-foreground transition-colors">
                  Terms
                </Link>
                <Link href="#" className="hover:text-foreground transition-colors">
                  Support
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
