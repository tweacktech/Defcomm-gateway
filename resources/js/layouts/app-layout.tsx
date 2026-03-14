
import { Toaster } from '@/components/ui/sonner';
import { useFlash } from '@/hooks/use-flash';
import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import type { AppLayoutProps } from '@/types';



export default function AppLayout({ children, breadcrumbs, ...props }: AppLayoutProps) {
    useFlash();

    return (
        <AppLayoutTemplate breadcrumbs={breadcrumbs} {...props}>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
        </AppLayoutTemplate>
    );
}
