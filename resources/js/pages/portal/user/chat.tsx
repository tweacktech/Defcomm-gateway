import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';

export default function ChatPage() {
    const { conversations, messages, peer_id, contacts, notifications } = usePage<{
        conversations: any[];
        messages: any[];
        peer_id: number | null;
        contacts: any[];
        notifications: any[];
    } & Record<string, unknown>>().props;
    const [text, setText] = useState('');
    const authUser = usePage().props.auth as { user?: { id: number } };

    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Chat', href: '/app/chat' }]}>
            <Head title="Chat" />
            <div className="grid gap-4 p-6 lg:grid-cols-[260px_1fr_240px]" style={{ minHeight: '70vh' }}>
                <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="border-b p-3 font-semibold">Conversations</div>
                    <div className="max-h-[60vh] overflow-y-auto">
                        {contacts.map((c) => (
                            <Link key={c.id} href={`/app/chat?peer=${c.user_link}`} className={`block border-b px-3 py-2 text-sm hover:bg-muted/50 ${peer_id === c.user_link ? 'bg-muted' : ''}`}>
                                <div className="font-medium">{c.contact?.name}</div>
                                <div className="text-xs text-muted-foreground truncate">{c.contact?.email}</div>
                            </Link>
                        ))}
                        {conversations.map((c) => {
                            const peer = c.user_id === authUser?.user?.id ? c.user_to : c.user_id;
                            return (
                                <Link key={`c-${c.id}`} href={`/app/chat?peer=${peer}`} className="block border-b px-3 py-2 text-sm hover:bg-muted/50">
                                    <div className="font-medium">User #{peer}</div>
                                    <div className="text-xs text-muted-foreground truncate">{c.last_message}</div>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-col rounded-xl border bg-card overflow-hidden">
                    <div className="border-b p-3 font-semibold">{peer_id ? `Chat with #${peer_id}` : 'Select a contact'}</div>
                    <div className="flex-1 space-y-2 overflow-y-auto p-4">
                        {messages.map((m) => (
                            <div key={m.id} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.user_id === authUser?.user?.id ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                {m.message}
                            </div>
                        ))}
                    </div>
                    {peer_id && (
                        <form className="flex gap-2 border-t p-3" onSubmit={(e) => {
                            e.preventDefault();
                            if (!text.trim()) return;
                            router.post('/app/chat', { peer_id, message: text }, { onSuccess: () => setText('') });
                        }}>
                            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" />
                            <Button type="submit">Send</Button>
                        </form>
                    )}
                </div>

                <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="border-b p-3 font-semibold">Notifications</div>
                    <div className="space-y-2 p-3">
                        {notifications.map((n) => (
                            <div key={n.id} className="rounded-lg border p-2 text-sm">
                                <div className="font-medium">{n.title}</div>
                                <div className="text-xs text-muted-foreground">{n.body}</div>
                            </div>
                        ))}
                        {notifications.length === 0 && <div className="text-sm text-muted-foreground">No notifications.</div>}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
