import { Head, usePage, router } from '@inertiajs/react';
import axios from 'axios';
import {
  Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff,
  PhoneOff, Hand, MessageSquare, Users, Copy, Check, Shield,
  ChevronLeft, Clock, X, LogOut, StopCircle, Monitor,
  UserX, UserCheck, Hourglass, AlertTriangle,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { useWebRTCMesh } from '@/hooks/useWebRTCMesh';
import type { PeerInfo, ChatMsg, WaitingPeer } from '@/hooks/useWebRTCMesh';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomConfig {
  id: number;
  uid: string;
  name: string;
  status: string;
  video_enabled: boolean;
  audio_enabled: boolean;
  chat_enabled: boolean;
  screen_share_enabled: boolean;
  recording_enabled: boolean;
  waiting_room: boolean;
  join_url: string;
}

type PageProps = {
  room: RoomConfig;
  peer_id: string;
  display_name: string;
  is_owner: boolean;
  is_guest: boolean;
  reverb_key: string;
  reverb_host: string;
  reverb_port: number;
  reverb_use_tls?: boolean;
};

type EndReason = 'left' | 'kicked' | 'room-ended';

const http = {
  post: (url: string, data?: object) => axios.post(url, data ?? {}).then(r => r.data),
  patch: (url: string, data?: object) => axios.patch(url, data ?? {}).then(r => r.data),
};

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ─── VideoTile ────────────────────────────────────────────────────────────────

function VideoTile({ peer, local = false, pinned = false, onClick }: {
  peer: PeerInfo; local?: boolean; pinned?: boolean; onClick?: () => void;
}) {
  const vRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = vRef.current;
    if (!el || !peer.stream) return;
    if (el.srcObject !== peer.stream) el.srcObject = peer.stream;
  }, [peer.stream]);

  useEffect(() => {
    const el = vRef.current;
    if (!el || local || !peer.stream) return;
    el.muted = false;
    el.play().catch(() => {});
  }, [peer.stream, local]);

  const initial = peer.display_name[0]?.toUpperCase() ?? '?';
  const ring = peer.speaking
    ? 'ring-2 ring-green-400/80 shadow-green-900/30 shadow-lg'
    : pinned ? 'ring-2 ring-primary/50' : '';

  return (
    <div
      onClick={onClick}
      className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-900 transition-all duration-150 ${ring} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <video
        ref={vRef}
        autoPlay
        muted={local}
        playsInline
        className={`h-full w-full object-cover ${peer.video_on && peer.stream ? '' : 'hidden'}`}
      />
      {(!peer.video_on || !peer.stream) && (
        <div className="flex flex-col items-center gap-2 p-2">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white ${peer.speaking ? 'bg-green-600' : 'bg-zinc-700'}`}>
            {initial}
          </div>
          <span className="max-w-[8rem] truncate text-xs text-zinc-400">{peer.display_name}</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-2 text-xs text-white">
        {peer.speaking && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-green-400" />}
        {!peer.audio_on && <MicOff className="h-3 w-3 shrink-0 text-red-400" />}
        {peer.hand_raised && <Hand className="h-3 w-3 shrink-0 text-yellow-400" />}
        {peer.screen_sharing && <Monitor className="h-3 w-3 shrink-0 text-blue-400" />}
        <span className="min-w-0 flex-1 truncate font-medium drop-shadow">
          {local ? `${peer.display_name} (You)` : peer.display_name}
        </span>
        {peer.role === 'host' && <Shield className="h-3 w-3 shrink-0 text-primary" />}
      </div>
    </div>
  );
}

// ─── ScreenView ───────────────────────────────────────────────────────────────

function ScreenView({ stream, owner, isLocal, onStop }: {
  stream: MediaStream; owner: string; isLocal: boolean; onStop?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (!isLocal) { el.muted = false; el.play().catch(() => {}); }
  }, [stream, isLocal]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-black ring-2 ring-blue-500/30">
      <video ref={ref} autoPlay muted={isLocal} playsInline className="h-full w-full object-contain" />
      <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-blue-700/90 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
        <Monitor className="h-3.5 w-3.5" />
        {isLocal ? 'You are sharing' : `${owner}'s screen`}
      </div>
      {isLocal && onStop && (
        <button onClick={onStop} className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600">
          <StopCircle className="h-3.5 w-3.5" /> Stop sharing
        </button>
      )}
    </div>
  );
}

// ─── WaitingOverlay ───────────────────────────────────────────────────────────

function WaitingOverlay({ name, onResend }: { name: string; onResend: () => Promise<void> }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const handle = async () => {
    setStatus('sending');
    await onResend();
    setStatus('sent');
    setTimeout(() => setStatus('idle'), 3000);
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-zinc-950/95 backdrop-blur-sm">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-yellow-500/10" />
        <div className="flex h-full w-full items-center justify-center rounded-full bg-yellow-500/15">
          <Hourglass className="h-8 w-8 animate-pulse text-yellow-400" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-white">Waiting to be admitted</p>
        <p className="mt-2 text-sm text-zinc-400">
          The host will let you into <span className="font-semibold text-white">{name}</span> shortly
        </p>
      </div>
      <p className="rounded-full border border-zinc-800 px-4 py-1.5 text-xs text-zinc-500">
        Camera and microphone are paused while you wait
      </p>
      <button
        onClick={handle}
        disabled={status !== 'idle'}
        className={[
          'flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-all duration-200',
          status === 'sent' ? 'cursor-default border-green-500/40 bg-green-500/10 text-green-400'
            : status === 'sending' ? 'cursor-wait border-zinc-700 bg-zinc-800/50 text-zinc-500'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white',
        ].join(' ')}
      >
        {status === 'sent' ? <><Check className="h-4 w-4 text-green-400" /> Request sent</>
          : status === 'sending' ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" /> Sending…</>
            : <><UserCheck className="h-4 w-4" /> Resend admission request</>}
      </button>
      <Button onClick={() => router.get('/meet')} variant="outline" className="min-w-[200px] gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
        <Video className="h-4 w-4" /> Go to Meetings
      </Button>
    </div>
  );
}

// ─── AdmitPanel ───────────────────────────────────────────────────────────────

function AdmitPanel({ list, onAdmit, onDeny }: {
  list: WaitingPeer[]; onAdmit: (id: string) => void; onDeny: (id: string) => void;
}) {
  if (!list.length) return null;
  return (
    <div className="absolute top-16 left-1/2 z-30 w-80 -translate-x-1/2 rounded-2xl border border-yellow-500/25 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-yellow-400 uppercase">
        <Hourglass className="h-3.5 w-3.5" /> {list.length} waiting to join
      </p>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {list.map(p => (
          <div key={p.peer_id} className="flex items-center gap-3 rounded-xl bg-zinc-800 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white">
              {p.display_name[0]?.toUpperCase()}
            </div>
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{p.display_name}</span>
            <button onClick={() => onAdmit(p.peer_id)} className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600/20 text-green-400 transition hover:bg-green-600 hover:text-white">
              <UserCheck className="h-4 w-4" />
            </button>
            <button onClick={() => onDeny(p.peer_id)} className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600/20 text-red-400 transition hover:bg-red-600 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

function HostLeaveDialog({ onEndAll, onLeaveOnly, onCancel }: {
  onEndAll: () => void; onLeaveOnly: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-700/60 bg-zinc-900 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
          <PhoneOff className="h-6 w-6 text-red-400" />
        </div>
        <h2 className="mb-1 text-lg font-bold text-white">Leave Meeting?</h2>
        <p className="mb-6 text-sm text-zinc-400">End for everyone or leave and let others continue.</p>
        <div className="space-y-2">
          <Button onClick={onEndAll} className="w-full gap-2 bg-red-600 hover:bg-red-500">
            <StopCircle className="h-4 w-4" /> End for Everyone
          </Button>
          <Button onClick={onLeaveOnly} variant="outline" className="w-full gap-2 border-zinc-600 text-zinc-200 hover:bg-zinc-800">
            <LogOut className="h-4 w-4" /> Leave — Let Others Continue
          </Button>
          <button onClick={onCancel} className="w-full py-2 text-sm text-zinc-500 transition hover:text-zinc-300">
            Stay in Meeting
          </button>
        </div>
      </div>
    </div>
  );
}

function GuardDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-yellow-500/25 bg-zinc-900 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500/10">
          <AlertTriangle className="h-6 w-6 text-yellow-400" />
        </div>
        <h2 className="mb-1 text-lg font-bold text-white">Leave the Meeting?</h2>
        <p className="mb-1 text-sm text-zinc-400">Navigating away will disconnect you from the call.</p>
        <p className="mb-6 text-xs text-zinc-600">Recording and background services will stop.</p>
        <div className="space-y-2">
          <Button onClick={onStay} className="w-full bg-primary hover:bg-primary/90">Stay in Meeting</Button>
          <button onClick={onLeave} className="w-full py-2 text-sm text-zinc-500 transition hover:text-red-400">Leave Anyway</button>
        </div>
      </div>
    </div>
  );
}

function EndScreen({ name, reason }: { name: string; reason: EndReason }) {
  const map: Record<EndReason, { icon: string; title: string; sub: string }> = {
    left: { icon: '👋', title: 'You left the meeting', sub: 'The call has ended on your side.' },
    kicked: { icon: '🚫', title: 'You were removed', sub: 'The host ended your session.' },
    'room-ended': { icon: '📴', title: 'Meeting ended', sub: 'The host ended the meeting for everyone.' },
  };
  const { icon, title, sub } = map[reason];
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-zinc-950 text-white">
      <span className="text-6xl">{icon}</span>
      <div className="text-center">
        <p className="text-xl font-bold">{title}</p>
        <p className="mt-1 text-sm text-zinc-400">{sub}</p>
        <p className="mt-0.5 text-xs text-zinc-600">{name}</p>
      </div>
      <a href="/meet" className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800">
        Go Home
      </a>
    </div>
  );
}

function RecBadge({ duration }: { duration: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-red-600/20 px-2.5 py-1 text-xs font-medium text-red-400">
      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
      REC {fmtDur(duration)}
    </div>
  );
}

function Btn({ on, red, blue, yellow, wide, onClick, title, children }: {
  on?: boolean; red?: boolean; blue?: boolean; yellow?: boolean;
  wide?: boolean; onClick: () => void; title?: string; children: React.ReactNode;
}) {
  const base = 'flex items-center justify-center rounded-full transition-all duration-150';
  const size = wide ? 'h-11 w-14' : 'h-11 w-11';
  const col = red ? 'bg-red-600 hover:bg-red-500'
    : blue ? on ? 'bg-blue-600 ring-2 ring-blue-400/30 hover:bg-blue-500' : 'bg-zinc-700 hover:bg-zinc-600'
      : yellow ? on ? 'bg-yellow-500 ring-2 ring-yellow-400/30 hover:bg-yellow-400' : 'bg-zinc-700 hover:bg-zinc-600'
        : on ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-red-600 hover:bg-red-500';
  return (
    <button onClick={onClick} title={title} className={`${base} ${size} ${col}`}>
      {children}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MeetRoom() {
  const {
    room, peer_id, display_name, is_owner, is_guest,
    reverb_key, reverb_host, reverb_port, reverb_use_tls,
  } = usePage<PageProps>().props;

  const {
    peers = new Map(),
    waiting,
    localStream,
    screenStream,
    connectionState,
    startMedia,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    setupEcho,
    teardown,
    broadcastChat,
    broadcastMediaState,
  } = useWebRTCMesh();

  const [videoOn, setVideoOn] = useState(is_owner && room.video_enabled);
  const [audioOn, setAudioOn] = useState(is_owner && room.audio_enabled);
  const [handRaised, setHandRaised] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [hostDialog, setHostDialog] = useState(false);
  const [guardDialog, setGuardDialog] = useState(false);
  const [endReason, setEndReason] = useState<EndReason | null>(null);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [rec] = useState({ id: null as number | null, active: false, duration: 0 });
  const [isWaiting, setIsWaiting] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Use refs for values needed inside the setupEcho callbacks to avoid
  // stale closures (callbacks are registered once on mount)
  const R = useRef({
    inMeeting: true,
    pendingNav: null as (() => void) | null,
    seenMsgs: new Set<string>(),
    chatOpen: false,       // mirror of chatOpen state — avoids stale closure
  });

  // Keep ref in sync with state
  useEffect(() => { R.current.chatOpen = chatOpen; }, [chatOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  // ── navigation guard ──────────────────────────────────────────────────────

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!R.current.inMeeting) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const onPop = () => {
      if (!R.current.inMeeting) return;
      window.history.pushState(null, '', window.location.href);
      R.current.pendingNav = () => window.history.back();
      setGuardDialog(true);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  // ── mount: join → start media → setup Echo ────────────────────────────────

  useEffect(() => {
    let mounted = true;

    (async () => {
      const resp = await http
        .post(`/meet/${room.uid}/join`, {
          peer_id,
          display_name,
          video_on: is_owner && room.video_enabled,
          audio_on: is_owner && room.audio_enabled,
        })
        .catch(() => ({ admitted: true }));

      if (!mounted) return;

      const admitted = resp?.admitted !== false;

      // Callbacks defined once — use R.current refs to avoid stale closures
      const callbacks = {
        onError: (msg: string) => toast.error(msg),
        onConnectionStateChanged: (state: string) => {
          if (state === 'connected') toast.success('Connected to meeting');
        },
        onPeerJoined: (peer: PeerInfo) => {
          toast.info(`${peer.display_name} joined the meeting`);
        },
        onPeerLeft: (_pid: string, name: string) => {
          toast.info(`${name} left the meeting`);
        },
        onChatMessage: (msg: ChatMsg) => {
          if (R.current.seenMsgs.has(msg.id)) return;
          R.current.seenMsgs.add(msg.id);
          setMsgs(prev => [...prev, msg]);
          // Use ref to check chatOpen — avoids stale closure
          if (!R.current.chatOpen) {
            toast.message(`${msg.display_name}: ${msg.text}`, { duration: 3000 });
          }
        },
        onRoomEnded: () => {
          R.current.inMeeting = false;
          teardown();
          setEndReason('room-ended');
        },
        onKicked: () => {
          R.current.inMeeting = false;
          teardown();
          setEndReason('kicked');
        },
        onAdmitted: async () => {
          setIsWaiting(false);
          await startMedia();
          setVideoOn(room.video_enabled);
          setAudioOn(room.audio_enabled);
          toast.success('You have been admitted to the meeting');
        },
      };

      if (admitted) {
        await startMedia();
      } else {
        // Show waiting overlay but still connect to Echo so we receive
        // the ParticipantAdmitted event when the host lets us in
        setIsWaiting(true);
      }

      // Always setup Echo regardless of admitted — waiting peers need
      // to receive ParticipantAdmitted / RoomEnded events
      await setupEcho(
        reverb_key,
        reverb_host,
        reverb_port,
        reverb_use_tls ?? false,
        peer_id,
        room.uid,
        callbacks,
      );
    })();

    return () => {
      mounted = false;
      R.current.inMeeting = false;
      teardown();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── controls ──────────────────────────────────────────────────────────────

  const handleToggleAudio = () => {
    const next = !audioOn;
    toggleAudio(next);
    setAudioOn(next);
    broadcastMediaState({ audio_on: next, video_on: videoOn, screen_sharing: !!screenStream, hand_raised: handRaised });
  };

  const handleToggleVideo = () => {
    const next = !videoOn;
    toggleVideo(next);
    setVideoOn(next);
    broadcastMediaState({ video_on: next, audio_on: audioOn, screen_sharing: !!screenStream, hand_raised: handRaised });
  };

  const handleToggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    broadcastMediaState({ hand_raised: next, video_on: videoOn, audio_on: audioOn, screen_sharing: !!screenStream });
  };

  const admitPeer = async (id: string) => {
    await http.patch(`/meet/${room.uid}/admit/${id}`).catch(() => {});
  };

  const denyPeer = async (id: string) => {
    await http.patch(`/meet/${room.uid}/kick/${id}`).catch(() => {});
  };

  const leaveRoom = useCallback(async () => {
    R.current.inMeeting = false;
    await http.post(`/meet/${room.uid}/leave`, { peer_id }).catch(() => {});
    teardown();
    if (is_guest) setEndReason('left');
    else router.get('/meet');
  }, [room.uid, peer_id, is_guest, teardown]);

  const endForAll = useCallback(async () => {
    R.current.inMeeting = false;
    await http.patch(`/meet/${room.uid}/end`).catch(() => {});
    teardown();
    if (is_guest) setEndReason('left');
    else router.get('/meet');
  }, [room.uid, is_guest, teardown]);

  const doNav = () => {
    setGuardDialog(false);
    R.current.inMeeting = false;
    const f = R.current.pendingNav;
    R.current.pendingNav = null;
    if (f) f(); else leaveRoom();
  };

  const handleResendAdmission = useCallback(async () => {
    await http.post(`/meet/${room.uid}/join`, {
      peer_id, display_name, video_on: false, audio_on: false,
    }).catch(() => {});
  }, [room.uid, peer_id, display_name]);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const msg: ChatMsg = {
      id: crypto.randomUUID(),
      peer_id,
      display_name,
      text: chatInput.trim(),
      sent_at: new Date().toISOString(),
    };
    R.current.seenMsgs.add(msg.id);
    broadcastChat(msg);
    setMsgs(prev => [...prev, msg]);
    setChatInput('');
  };

  // ── render ────────────────────────────────────────────────────────────────

  if (endReason) return <EndScreen name={display_name} reason={endReason} />;

  const allPeers = Array.from(peers.values()).filter(p => p.peer_id !== peer_id);
  const total = allPeers.length + 1;
  const sharingPeer = allPeers.find(p => p.screen_sharing && p.stream);
  const anySharing = !!screenStream || !!sharingPeer;

  const gridCols = anySharing
    ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5'
    : total <= 1 ? 'grid-cols-1'
      : total <= 4 ? 'grid-cols-2'
        : total <= 9 ? 'grid-cols-3'
          : total <= 16 ? 'grid-cols-4'
            : 'grid-cols-5';

  const localPeer: PeerInfo = {
    peer_id,
    display_name,
    role: is_owner ? 'host' : 'participant',
    video_on: videoOn,
    audio_on: audioOn,
    screen_sharing: !!screenStream,
    hand_raised: handRaised,
    speaking: false,
    stream: localStream ?? undefined,
  };

  return (
    <div className="relative flex h-screen flex-col bg-zinc-950 text-white">
      <Head title={room.name} />
      <Toaster position="bottom-right" richColors closeButton />

      {guardDialog && (
        <GuardDialog
          onStay={() => { setGuardDialog(false); R.current.pendingNav = null; }}
          onLeave={doNav}
        />
      )}

      {/* Waiting overlay — participant waiting for host admission */}
      {isWaiting && !endReason && (
        <WaitingOverlay name={room.name} onResend={handleResendAdmission} />
      )}

      {/* Admit panel — host sees this when waiting_room is on */}
      {is_owner && room.waiting_room && waiting.length > 0 && (
        <AdmitPanel list={waiting} onAdmit={admitPeer} onDeny={denyPeer} />
      )}

      {hostDialog && (
        <HostLeaveDialog
          onEndAll={() => { setHostDialog(false); endForAll(); }}
          onLeaveOnly={() => { setHostDialog(false); leaveRoom(); }}
          onCancel={() => setHostDialog(false)}
        />
      )}

      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-4 py-2.5">
        <div className="flex items-center gap-3">
          {!is_guest && (
            <button
              onClick={() => { R.current.pendingNav = () => router.get('/meet'); setGuardDialog(true); }}
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <p className="text-sm leading-none font-semibold">{room.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {total} participant{total !== 1 ? 's' : ''}
              </span>
              {waiting.length > 0 && (
                <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400">
                  {waiting.length} waiting
                </span>
              )}
              {is_guest && (
                <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px]">Guest</span>
              )}
              {connectionState !== 'connected' && connectionState !== 'idle' && (
                <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400">
                  {connectionState}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rec.active && <RecBadge duration={rec.duration} />}
          <button
            onClick={() => { navigator.clipboard.writeText(room.join_url); setUrlCopied(true); setTimeout(() => setUrlCopied(false), 2000); }}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs transition hover:bg-zinc-800"
          >
            {urlCopied ? <><Check className="h-3.5 w-3.5 text-green-400" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Invite</>}
          </button>
          <div className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-2.5 py-1.5 text-xs text-green-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
            Live
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 gap-2 p-2.5">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          {anySharing && (
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl">
              {screenStream
                ? <ScreenView stream={screenStream} owner={display_name} isLocal onStop={stopScreenShare} />
                : sharingPeer?.stream
                  ? <ScreenView stream={sharingPeer.stream} owner={sharingPeer.display_name} isLocal={false} />
                  : null}
            </div>
          )}
          <div className={['grid gap-2', gridCols, anySharing ? 'h-28 shrink-0 overflow-x-auto' : 'min-h-0 flex-1 content-start overflow-y-auto'].join(' ')}>
            <div className="aspect-video"><VideoTile peer={localPeer} local /></div>
            {allPeers.map(p => (
              <div key={p.peer_id} className="aspect-video">
                <VideoTile
                  peer={p}
                  pinned={!anySharing && p.peer_id === pinnedId}
                  onClick={() => { if (!anySharing) setPinnedId(id => id === p.peer_id ? null : p.peer_id); }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        {chatOpen && room.chat_enabled && (
          <div className="flex w-64 shrink-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <p className="text-sm font-semibold">Chat</p>
              <button onClick={() => setChatOpen(false)} className="text-zinc-500 transition hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
              {msgs.length === 0 && <p className="py-8 text-center text-xs text-zinc-600">No messages yet</p>}
              {msgs.map(m => (
                <div key={m.id} className="text-xs">
                  <span className="font-semibold text-zinc-300">{m.peer_id === peer_id ? 'You' : m.display_name}</span>
                  <span className="ml-1 break-words text-zinc-400">{m.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-zinc-800 p-3">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Message…"
                className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-primary"
                onKeyDown={e => { if (e.key === 'Enter') handleSendChat(); }}
              />
            </div>
          </div>
        )}

        {/* Participants */}
        {panelOpen && (
          <div className="flex w-56 shrink-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <p className="text-sm font-semibold">People <span className="text-zinc-500">({total})</span></p>
              <button onClick={() => setPanelOpen(false)} className="text-zinc-500 transition hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              <div className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-3 py-2 text-xs">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/40 text-[10px] font-bold text-white">
                  {display_name[0]?.toUpperCase()}
                </div>
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-200">{display_name} (You)</span>
                <div className="flex shrink-0 gap-1">
                  {!audioOn && <MicOff className="h-3 w-3 text-red-400" />}
                  {is_owner && <Shield className="h-3 w-3 text-primary" />}
                </div>
              </div>
              {allPeers.map(p => (
                <div key={p.peer_id} className="group flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition hover:bg-zinc-800/50">
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${p.speaking ? 'bg-green-500' : 'bg-zinc-700'}`}>
                    {p.display_name[0]?.toUpperCase()}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-zinc-300">{p.display_name}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    {!p.audio_on && <MicOff className="h-3 w-3 text-red-400" />}
                    {p.hand_raised && <Hand className="h-3 w-3 text-yellow-400" />}
                    {p.role === 'host' && <Shield className="h-3 w-3 text-primary" />}
                    {is_owner && p.role !== 'host' && (
                      <button
                        onClick={() => http.patch(`/meet/${room.uid}/kick/${p.peer_id}`).catch(() => {})}
                        title="Remove participant"
                        className="ml-0.5 hidden rounded p-0.5 text-zinc-500 transition group-hover:block hover:bg-red-600/20 hover:text-red-400"
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-zinc-800/80 bg-zinc-950 py-3">
        <Btn on={audioOn} onClick={handleToggleAudio} title={audioOn ? 'Mute' : 'Unmute'}>
          {audioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Btn>
        {room.video_enabled && (
          <Btn on={videoOn} onClick={handleToggleVideo} title={videoOn ? 'Camera off' : 'Camera on'}>
            {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Btn>
        )}
        {room.screen_share_enabled && (
          <Btn blue on={!!screenStream} onClick={screenStream ? stopScreenShare : startScreenShare} title={screenStream ? 'Stop sharing' : 'Share screen'}>
            {screenStream ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
          </Btn>
        )}
        <Btn yellow on={handRaised} onClick={handleToggleHand} title={handRaised ? 'Lower hand' : 'Raise hand'}>
          <Hand className="h-5 w-5" />
        </Btn>
        {room.chat_enabled && (
          <Btn blue on={chatOpen} onClick={() => { setChatOpen(c => !c); setPanelOpen(false); }} title="Chat">
            <MessageSquare className="h-5 w-5" />
          </Btn>
        )}
        <Btn blue on={panelOpen} onClick={() => { setPanelOpen(p => !p); setChatOpen(false); }} title="Participants">
          <Users className="h-5 w-5" />
        </Btn>
        <Btn red wide onClick={() => is_owner ? setHostDialog(true) : leaveRoom()} title="Leave">
          <PhoneOff className="h-5 w-5" />
        </Btn>
      </footer>
    </div>
  );
}
