import { Head } from '@inertiajs/react';
import TextLink from '@/components/text-link';
import AuthLayout from '@/layouts/auth-layout';
import { register, login } from '@/routes';

type Props = {
  status?: string;
  canRegister: boolean;
};

export default function Welcome({ status, canRegister }: Props) {
  return (
    <>
      <Head title="Welcome to Defcomm" />

      {/* Hero Section - Outside AuthLayout */}
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Welcome to <span className="text-primary">Defcomm</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A modern defense-grade communication platform built for speed,
            reliability, and secure collaboration. Stay connected. Stay protected.
          </p>
        </div>

        {/* Features Section - Outside AuthLayout */}
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="rounded-lg border p-6 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-lg mb-2">🔐 Secure Communication</h3>
              <p className="text-sm text-muted-foreground">
                End-to-end encrypted channels for safe conversations.
              </p>
            </div>

            <div className="rounded-lg border p-6 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-lg mb-2">⚡ Real-Time Interaction</h3>
              <p className="text-sm text-muted-foreground">
                Ultra-fast messaging and video communication powered by WebRTC.
              </p>
            </div>

            <div className="rounded-lg border p-6 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-lg mb-2">🌐 Scalable Infrastructure</h3>
              <p className="text-sm text-muted-foreground">
                Built to scale with your organization's needs.
              </p>
            </div>
          </div>
        </div>

        {/* Auth Section - Inside AuthLayout */}
        <div className="container mx-auto border-radius-lg px-0 py-0">
          <AuthLayout
            title="Defcomm Gateway"
            description="Secure • Intelligent • Real-time Communication"
          >
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-center">Get Started</h2>

              {/* CTA Section */}
              <div className="space-y-4">
                <div className="text-center text-sm text-muted-foreground">
                  Already have an account?
                  <br />
                  <TextLink
                    href={login()}
                    className="font-medium text-primary hover:underline"
                    tabIndex={1}
                  >
                    Log in to your dashboard →
                  </TextLink>
                </div>

                {canRegister && (
                  <div className="text-center text-sm text-muted-foreground">
                    New here?
                    <br />
                    <TextLink
                      href={register()}
                      className="font-medium text-primary hover:underline"
                      tabIndex={2}
                    >
                      Create an account →
                    </TextLink>
                  </div>
                )}
              </div>

              {/* Status Message */}
              {status && (
                <div className="rounded-md bg-green-50 p-3 text-center text-sm font-medium text-green-600 border border-green-200">
                  {status}
                </div>
              )}
            </div>
          </AuthLayout>
        </div>

        {/* Footer - Outside AuthLayout */}
        <footer className="border-t mt-16">
          <div className="container mx-auto px-4 py-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Defcomm. All rights reserved.
          </div>
        </footer>
      </div>
    </>
  );
}
