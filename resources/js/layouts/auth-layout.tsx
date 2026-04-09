import { Toaster } from '@/components/ui/sonner';
import AuthLayoutTemplate from '@/layouts/auth/auth-split-layout';
import IncomingCallNotification from '@/components/IncomingCallNotification';
import { usePage } from '@inertiajs/react';
import { useAuth } from '@/hooks/use-auth';

// Type declaration for window.reverbConfig (accessed at runtime)
declare global {
  interface Window {
    reverbConfig: {
      key: string;
      host: string;
      port: number;
    };
  }
}

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
  [key: string]: any;
}

export default function AuthLayout({
  children,
  title,
  description,
  ...props
}: AuthLayoutProps) {
  // Get Reverb config from Inertia shared props
  const { reverbConfig } = usePage().props;
  
  // Get authenticated user from your auth hook
  const { user } = useAuth();

  // Safety checks before rendering
  if (!user?.id) {
    console.warn('User not authenticated or user.id not available');
    return (
      <AuthLayoutTemplate title={title} description={description} {...props}>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </AuthLayoutTemplate>
    );
  }

  if (!reverbConfig?.key) {
    console.warn('Reverb config not available');
    return (
      <AuthLayoutTemplate title={title} description={description} {...props}>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </AuthLayoutTemplate>
    );
  }

  return (
    <AuthLayoutTemplate title={title} description={description} {...props}>
      <IncomingCallNotification
        userId={user.id}
        reverbKey={reverbConfig.key}
        reverbHost={reverbConfig.host}
        reverbPort={reverbConfig.port}
      />
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </AuthLayoutTemplate>
  );
}