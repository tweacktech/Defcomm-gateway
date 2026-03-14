import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';

type Flash = {
    success?: string;
    error?: string;
    info?: string;
    warning?: string;
    share_url?: string;   // used by DriveController::createShareLink
};

export function useFlash() {
    const { flash } = usePage<{ flash: Flash } & Record<string, unknown>>().props;

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error)   toast.error(flash.error);
        if (flash?.info)    toast.info(flash.info);
        if (flash?.warning) toast.warning(flash.warning);
    }, [flash]);
}
