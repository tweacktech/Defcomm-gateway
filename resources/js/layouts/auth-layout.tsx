import { Toaster } from '@/components/ui/sonner';
// import { useFlash } from '@/hooks/use-flash';
import AuthLayoutTemplate from '@/layouts/auth/auth-split-layout';

import IncomingCallNotification from '@/components/IncomingCallNotification';

export default function AuthLayout({
    children,
    title,
    description,
    ...props
}: {
    children: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        
        <AuthLayoutTemplate title={title} description={description} {...props}>
             <IncomingCallNotification userId={auth.user.id} reverbKey={...} reverbHost={...} reverbPort={...} />
             
            {children}
            <Toaster position="bottom-right" richColors closeButton />
        </AuthLayoutTemplate>
    );
}
