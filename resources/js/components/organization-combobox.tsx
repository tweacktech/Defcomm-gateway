// resources/js/components/organization-combobox.tsx
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface OrganizationOption {
    id: number;
    name: string;
    email: string | null;
}

interface Props {
    value: { id: number | null; name: string };
    onChange: (value: { id: number | null; name: string }) => void;
    error?: string;
    tabIndex?: number;
}

export function OrganizationCombobox({ value, onChange, error, tabIndex }: Props) {
    const [query, setQuery] = useState(value.name);
    const [results, setResults] = useState<OrganizationOption[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const search = (q: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (q.length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/organizations/search?q=${encodeURIComponent(q)}`);
                const data: OrganizationOption[] = await res.json();
                setResults(data);
                setOpen(true);
            } finally {
                setLoading(false);
            }
        }, 250);
    };

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value;
        setQuery(q);
        // Typing clears any prior selection — the name is now a new org
        onChange({ id: null, name: q });
        search(q);
    };

    const select = (org: OrganizationOption) => {
        setQuery(org.name);
        onChange({ id: org.id, name: org.name });
        setResults([]);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            <Input
                type="text"
                placeholder="Type to search or create a new organization…"
                value={query}
                onChange={handleInput}
                tabIndex={tabIndex}
                autoComplete="off"
                className={cn(error && 'border-destructive')}
            />

            {/* Badge when an existing org is selected */}
            {value.id && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Existing
                </span>
            )}

            {/* Dropdown */}
            {open && (results.length > 0 || loading) && (
                <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                    {loading && (
                        <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>
                    )}
                    {results.map((org) => (
                        <li
                            key={org.id}
                            onMouseDown={() => select(org)}
                            className="flex cursor-pointer flex-col px-3 py-2 text-sm hover:bg-accent"
                        >
                            <span className="font-medium">{org.name}</span>
                            {org.email && (
                                <span className="text-xs text-muted-foreground">{org.email}</span>
                            )}
                        </li>
                    ))}
                    {!loading && query.length >= 2 && (
                        <li className="border-t px-3 py-2 text-sm text-muted-foreground">
                            No match?{' '}
                            <button
                                type="button"
                                className="text-primary underline"
                                onMouseDown={() => {
                                    onChange({ id: null, name: query });
                                    setOpen(false);
                                }}
                            >
                                Create "{query}"
                            </button>
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
