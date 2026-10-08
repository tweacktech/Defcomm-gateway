import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';

/**
 * Shows only when opening a different page (sidebar/link GET navigation).
 * Hidden for prefetch, forms, partial reloads, and same-path updates.
 */
export default function PageLoader() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let tracking = false;
        let delayTimer: ReturnType<typeof setTimeout> | null = null;

        const clearDelay = () => {
            if (delayTimer) {
                clearTimeout(delayTimer);
                delayTimer = null;
            }
        };

        const hide = () => {
            tracking = false;
            clearDelay();
            setVisible(false);
        };

        const shouldTrack = (visit: {
            method: string;
            prefetch: boolean;
            async: boolean;
            only: string[];
            except: string[];
            url: URL;
        }) => {
            if (visit.prefetch || visit.async) return false;
            if (visit.method.toLowerCase() !== 'get') return false;
            if (visit.only.length > 0 || visit.except.length > 0) return false;
            // Same path = filters/search/pagination, not a new page
            if (visit.url.pathname === window.location.pathname) return false;
            return true;
        };

        const offStart = router.on('start', (event) => {
            if (!shouldTrack(event.detail.visit)) return;
            tracking = true;
            clearDelay();
            delayTimer = setTimeout(() => {
                delayTimer = null;
                if (tracking) setVisible(true);
            }, 80);
        });

        const offDone = [
            router.on('finish', () => {
                if (tracking) hide();
            }),
            router.on('navigate', () => {
                if (tracking) hide();
            }),
            router.on('cancel', () => {
                if (tracking) hide();
            }),
            router.on('error', () => {
                if (tracking) hide();
            }),
        ];

        return () => {
            offStart();
            offDone.forEach((off) => off());
            clearDelay();
        };
    }, []);

    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/60 backdrop-blur-[2px]"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Loading page"
        >
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-8 py-6 shadow-lg">
                <Spinner className="size-8 text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Loading…</p>
            </div>
        </div>
    );
}
