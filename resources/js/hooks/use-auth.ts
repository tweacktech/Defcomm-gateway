import { usePage } from '@inertiajs/react';

export function useAuth() {
  const { props } = usePage() as any;

  return {
    user: props.auth?.user || null,
  };
}