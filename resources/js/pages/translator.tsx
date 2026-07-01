import { Head, Link, usePage } from '@inertiajs/react';
import { Languages, Loader2, Mic, Volume2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

type Service = {
    id: number;
    key: string;
    name: string;
    description: string | null;
    is_active: boolean;
};

type PageProps = {
    service: Service;
    usageStats?: number;
} & Record<string, unknown>;

async function parseJsonResponse(res: Response): Promise<{
    success?: boolean;
    output?: string;
    audio_url?: string;
    error?: string;
    stdout?: string;
}> {
    const text = await res.text();
    try {
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        return { success: false, error: text || `HTTP ${res.status}` };
    }
}

export default function Translator() {
    const { service, usageStats } = usePage<PageProps>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        {
            title: service.name,
            href: '/services/translator',
        },
    ];

    const [sourceLang, setSourceLang] = useState('english');
    const [targetLang, setTargetLang] = useState('igbo');
    const [text, setText] = useState('Hello, world.');
    const [textOut, setTextOut] = useState('');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [loading, setLoading] = useState<'text' | 'tts' | 'audio' | null>(
        null,
    );
    const [error, setError] = useState<string | null>(null);

    const runTextTranslate = useCallback(async () => {
        setError(null);
        setLoading('text');
        setTextOut('');
        setAudioUrl(null);
        try {
            const res = await fetch('/api/client/translate-text', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    text,
                    source_lang: sourceLang,
                    target_lang: targetLang,
                }),
            });
            const data = await parseJsonResponse(res);
            if (!res.ok || data.success === false) {
                setError(
                    data.error ||
                        data.stdout ||
                        `Request failed (${res.status})`,
                );
                return;
            }
            setTextOut(data.output ?? '');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Request failed');
        } finally {
            setLoading(null);
        }
    }, [sourceLang, targetLang, text]);

    const runTextTranslateAudio = useCallback(async () => {
        setError(null);
        setLoading('tts');
        setTextOut('');
        setAudioUrl(null);
        try {
            const res = await fetch('/api/client/text-translate-audio', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    text,
                    source_lang: sourceLang,
                    target_lang: targetLang,
                }),
            });
            const data = await parseJsonResponse(res);
            if (!res.ok || data.success === false) {
                setError(data.error || `Request failed (${res.status})`);
                return;
            }
            setTextOut(data.output ?? '');
            if (data.audio_url) {
                setAudioUrl(data.audio_url);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Request failed');
        } finally {
            setLoading(null);
        }
    }, [sourceLang, targetLang, text]);

    const runAudioTranslate = useCallback(async () => {
        if (!audioFile) {
            setError('Choose an audio file first.');
            return;
        }
        setError(null);
        setLoading('audio');
        setTextOut('');
        setAudioUrl(null);
        try {
            const form = new FormData();
            form.append('audio', audioFile);
            form.append('source_lang', sourceLang);
            form.append('target_lang', targetLang);

            const res = await fetch('/api/client/translate-audio', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: form,
            });
            const data = await parseJsonResponse(res);
            if (!res.ok || data.success === false) {
                setError(
                    data.error ||
                        data.stdout ||
                        `Request failed (${res.status})`,
                );
                return;
            }
            setTextOut(data.output ?? '');
            if (data.audio_url) {
                setAudioUrl(data.audio_url);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Request failed');
        } finally {
            setLoading(null);
        }
    }, [audioFile, sourceLang, targetLang]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={service.name} />

            <div className="flex flex-col gap-8 p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-primary/10 p-3">
                            <Languages className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">
                                {service.name}
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {service.description ??
                                    'Try the Python translation pipeline (text, text + speech, or audio in).'}
                            </p>
                            {usageStats != null && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Usage (demo stat): {usageStats}
                                </p>
                            )}
                        </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard">Back to dashboard</Link>
                    </Button>
                </div>

                {error && (
                    <div
                        className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-6">
                        <h2 className="text-lg font-semibold">
                            Languages &amp; text
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Use{' '}
                            <a
                                className="text-primary underline-offset-4 hover:underline"
                                href="/translator"
                                target="_blank"
                                rel="noreferrer"
                            >
                                deep-translator
                            </a>{' '}
                            language Model (e.g.{' '}
                            <code className="text-xs">english</code>,{' '}
                            <code className="text-xs">igbo</code>,{' '}
                            <code className="text-xs">hausa</code>,
                            <code className="text-xs">yoruba</code>).
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="src">Source language</Label>
                                <Input
                                    id="src"
                                    value={sourceLang}
                                    onChange={(e) =>
                                        setSourceLang(e.target.value.trim())
                                    }
                                    placeholder="english"
                                    autoComplete="off"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tgt">Target language</Label>
                                <Input
                                    id="tgt"
                                    value={targetLang}
                                    onChange={(e) =>
                                        setTargetLang(e.target.value.trim())
                                    }
                                    placeholder="hausa"
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="txt">Text</Label>
                            <textarea
                                id="txt"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                rows={5}
                                className={cn(
                                    'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground',
                                    'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                                )}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                onClick={runTextTranslate}
                                disabled={loading !== null || !text.trim()}
                            >
                                {loading === 'text' ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Translate text
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={runTextTranslateAudio}
                                disabled={loading !== null || !text.trim()}
                            >
                                {loading === 'tts' ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Volume2 className="mr-2 h-4 w-4" />
                                )}
                                Translate + TTS
                            </Button>
                        </div>
                    </div>

                    {/* <div className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-6">
                        <h2 className="text-lg font-semibold">
                            Audio file → translate
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Upload WAV, MP3, OGG, or MP4. The backend runs{' '}
                            <code className="text-xs">speech.py</code> with{' '}
                            <code className="text-xs">--file</code> and returns
                            translated text plus optional TTS audio.
                        </p>
                        <div className="space-y-2">
                            <Label htmlFor="audio">Audio file</Label>
                            <Input
                                id="audio"
                                type="file"
                                accept=".wav,.mp3,.ogg,.mp4,audio/*"
                                onChange={(e) =>
                                    setAudioFile(e.target.files?.[0] ?? null)
                                }
                            />
                        </div>
                        <Button
                            type="button"
                            onClick={runAudioTranslate}
                            disabled={loading !== null || !audioFile}
                        >
                            {loading === 'audio' ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Mic className="mr-2 h-4 w-4" />
                            )}
                            Translate audio
                        </Button>
                    </div> */}

                    <div className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-6">
                        <h2 className="text-lg font-semibold">
                            Audio file → translate
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Upload WAV, MP3, OGG, or MP4. The backend runs{' '}
                            <code className="text-xs">speech.py</code> with{' '}
                            <code className="text-xs">--file</code> and returns
                            translated text plus optional TTS audio.
                        </p>

                        {/* Add language inputs for audio section */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="audio-src">
                                    Source language
                                </Label>
                                <Input
                                    id="audio-src"
                                    value={sourceLang}
                                    onChange={(e) =>
                                        setSourceLang(e.target.value.trim())
                                    }
                                    placeholder="english"
                                    autoComplete="off"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="audio-tgt">
                                    Target language
                                </Label>
                                <Input
                                    id="audio-tgt"
                                    value={targetLang}
                                    onChange={(e) =>
                                        setTargetLang(e.target.value.trim())
                                    }
                                    placeholder="hausa"
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="audio">Audio file</Label>
                            <Input
                                id="audio"
                                type="file"
                                accept=".wav,.mp3,.ogg,.mp4,audio/*"
                                onChange={(e) =>
                                    setAudioFile(e.target.files?.[0] ?? null)
                                }
                            />
                        </div>

                        <Button
                            type="button"
                            onClick={runAudioTranslate}
                            disabled={loading !== null || !audioFile}
                        >
                            {loading === 'audio' ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Mic className="mr-2 h-4 w-4" />
                            )}
                            Translate audio
                        </Button>
                    </div>
                </div>

                {(textOut || audioUrl) && (
                    <div className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-6">
                        <h2 className="text-lg font-semibold">Result</h2>
                        {textOut ? (
                            <div className="space-y-2">
                                <Label>Output</Label>
                                <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/40 p-4 text-sm whitespace-pre-wrap">
                                    {textOut}
                                </pre>
                            </div>
                        ) : null}
                        {audioUrl ? (
                            <div className="space-y-2">
                                <Label>Generated audio</Label>
                                <audio
                                    className="w-full"
                                    controls
                                    src={audioUrl}
                                />
                                <a
                                    className="text-sm text-primary underline-offset-4 hover:underline"
                                    href={audioUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Open audio URL
                                </a>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
