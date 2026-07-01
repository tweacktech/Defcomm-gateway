<?php

namespace App\Console\Commands;

use App\Models\MeetRoom;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SendMeetReminders extends Command
{
    protected $signature = 'meet:send-reminders {--minutes=10 : Minutes before start to remind}';
    protected $description = 'Send reminders for scheduled meetings.';

    public function handle(): int
    {
        $minutes = (int) $this->option('minutes');
        if ($minutes <= 0) $minutes = 10;

        $now = CarbonImmutable::now();
        $from = $now->addMinutes($minutes);
        $to = $from->addMinute(); // small window to avoid duplicates

        $rooms = MeetRoom::query()
            ->with(['owner:id,name,email'])
            ->where('status', 'scheduled')
            ->whereNotNull('scheduled_at')
            ->whereNull('reminder_sent_at')
            ->whereBetween('scheduled_at', [$from, $to])
            ->get();

        $sent = 0;

        foreach ($rooms as $room) {
            $owner = $room->owner;
            if (!$owner?->email) {
                $room->update(['reminder_sent_at' => now()]);
                continue;
            }

            $subject = 'Meeting reminder';
            $when = $room->scheduled_at?->toDayDateTimeString() ?? 'soon';
            $name = $room->name ?? "Room {$room->uid}";
            $joinUrl = route('meet.room', $room->uid);

            Mail::raw("Reminder: \"{$name}\" starts at {$when}.\nJoin: {$joinUrl}\n", function ($m) use ($owner, $subject) {
                $m->to($owner->email)->subject($subject);
            });

            $room->update(['reminder_sent_at' => now()]);
            $sent++;
        }

        $this->info("Reminders sent: {$sent}");
        return self::SUCCESS;
    }
}

