import { useState, useEffect } from 'react';
import type { VoiceSession, ReminderItem, NoteItem } from '../types/assistant';
import { ReminderService } from '../services/reminderService';
import { NoteService } from '../services/noteService';
import { ttsService } from '../services/ttsService';

/* ── Fallback sample sessions ──────────── */

const initialVoiceSessions: VoiceSession[] = [
  {
    id: 's-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    transcript: 'Nale ravile 8 manikku enne remind cheyyanam.',
    aiResponse: 'ശരി, നാളെ രാവിലെ 8 മണിക്ക് ഞാൻ നിങ്ങളെ ഓർമ്മിപ്പിക്കാം.',
    language: 'mixed',
    intent: 'CREATE_REMINDER',
  },
  {
    id: 's-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    transcript: 'Note cheyyu, tomorrow client meeting undu.',
    aiResponse: 'ശരി, note save ചെയ്തു.',
    language: 'mixed',
    intent: 'CREATE_NOTE',
  },
  {
    id: 's-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
    transcript: '25 plus 35 ethra?',
    aiResponse: 'അത് 60 ആണ്.',
    language: 'mixed',
    intent: 'CALCULATE',
  },
  {
    id: 's-4',
    timestamp: new Date(Date.now() - 1000 * 60 * 300),
    transcript: 'Innathe Kochiyile weather engane aanu?',
    aiResponse: 'ഇന്ന് കൊച്ചിയിൽ താപനില 29 ഡിഗ്രി സെൽഷ്യസ് ആണ്. അന്തരീക്ഷം ഭാഗികമായി മേഘാവൃതമാണ്.',
    language: 'mixed',
    intent: 'GET_WEATHER',
  },
];

export default function History() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'reminders' | 'notes'>('sessions');
  const [sessions, setSessions] = useState<VoiceSession[]>(initialVoiceSessions);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('vaani_voice_sessions');
      if (stored) {
        const parsed: VoiceSession[] = JSON.parse(stored);
        if (parsed.length > 0) setSessions(parsed);
      }
    } catch (e) {
      console.warn('Could not read voice sessions');
    }

    // Fetch async data from backend
    ReminderService.getReminders().then(data => setReminders(data));
    setNotes(NoteService.getNotes());
  }, []);

  const handlePlayVoiceOutput = async (session: VoiceSession) => {
    if (playingId === session.id) {
      ttsService.stop();
      setPlayingId(null);
      return;
    }

    setPlayingId(session.id);
    await ttsService.speak(
      session.aiResponse,
      'ml-IN-Chirp3-HD-Aoede',
      () => setPlayingId(session.id),
      () => setPlayingId(null)
    );
  };

  const handleDeleteReminder = async (id: string) => {
    await ReminderService.deleteReminder(id);
    const updated = await ReminderService.getReminders();
    setReminders(updated);
  };

  const handleDeleteNote = (id: string) => {
    NoteService.deleteNote(id);
    setNotes(NoteService.getNotes());
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface-0">
      {/* Page Header */}
      <div className="px-5 py-4 bg-surface-50/90 border-b border-surface-100/50 backdrop-blur-md flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-surface-900 tracking-tight">
            Actions & Voice Log
          </h1>
          <p className="text-[11px] text-surface-400 font-medium">
            Visual reference for completed smart actions
          </p>
        </div>
        <span className="text-[10px] font-semibold text-primary-300 bg-primary-950/60 border border-primary-500/20 px-2.5 py-1 rounded-full">
          {sessions.length} Logged
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-100 px-4 bg-surface-50/40 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer ${
            activeTab === 'sessions'
              ? 'border-primary-500 text-primary-300 font-bold'
              : 'border-transparent text-surface-400 hover:text-surface-200'
          }`}
        >
          🎙️ Voice Sessions
        </button>
        <button
          onClick={() => setActiveTab('reminders')}
          className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'reminders'
              ? 'border-primary-500 text-primary-300 font-bold'
              : 'border-transparent text-surface-400 hover:text-surface-200'
          }`}
        >
          <span>⏰ Reminders</span>
          <span className="bg-primary-900/60 text-primary-300 px-1.5 py-0.2 rounded-full text-[10px]">
            {reminders.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'notes'
              ? 'border-primary-500 text-primary-300 font-bold'
              : 'border-transparent text-surface-400 hover:text-surface-200'
          }`}
        >
          <span>📝 Notes</span>
          <span className="bg-primary-900/60 text-primary-300 px-1.5 py-0.2 rounded-full text-[10px]">
            {notes.length}
          </span>
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* SESSIONS TAB */}
        {activeTab === 'sessions' &&
          sessions.map((s) => (
            <div
              key={s.id}
              className="bg-surface-100/40 border border-surface-200/40 rounded-2xl p-4 shadow-sm hover:border-primary-500/30 transition-all space-y-2.5"
            >
              <div className="flex items-center justify-between text-[11px] text-surface-400 border-b border-surface-200/30 pb-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <span>🎙️</span>
                  <span>
                    {new Date(s.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
                <span className="text-[10px] uppercase font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-md">
                  {s.intent || 'VOICE ACTION'}
                </span>
              </div>

              <div>
                <p className="text-[10px] text-surface-400 font-semibold uppercase tracking-wider mb-0.5">
                  Spoken Command
                </p>
                <p className="text-xs text-surface-800 font-medium italic">
                  "{s.transcript}"
                </p>
              </div>

              <div className="bg-primary-950/30 rounded-xl p-3 border border-primary-500/15 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[10px] text-primary-300 font-semibold uppercase tracking-wider mb-0.5">
                    VAANI Response
                  </p>
                  <p className="text-xs text-surface-900 font-medium leading-relaxed">
                    {s.aiResponse}
                  </p>
                </div>

                <button
                  onClick={() => handlePlayVoiceOutput(s)}
                  className={`p-2 rounded-xl text-white transition-all cursor-pointer shrink-0 ${
                    playingId === s.id
                      ? 'bg-red-500 animate-pulse'
                      : 'bg-primary-600 hover:bg-primary-500 active:scale-95'
                  }`}
                  title="Play VAANI Voice Response"
                >
                  {playingId === s.id ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}

        {/* REMINDERS TAB */}
        {activeTab === 'reminders' && (
          <div className="space-y-2.5">
            {reminders.length === 0 ? (
              <p className="text-xs text-surface-400 text-center py-6">
                No active reminders saved. Speak "Nale ravile 8 manikku remind cheyyanam" to create one.
              </p>
            ) : (
              reminders.map((rem) => (
                <div
                  key={rem.id}
                  className="bg-surface-100/50 border border-surface-200/50 rounded-2xl p-4 flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center text-lg shrink-0">
                      ⏰
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-surface-900">
                        {rem.title}
                      </h3>
                      <p className="text-[11px] text-surface-400 font-medium">
                        {rem.dateStr} at {rem.timeStr}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteReminder(rem.id)}
                    className="text-surface-400 hover:text-red-400 p-1.5 cursor-pointer"
                    title="Delete Reminder"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === 'notes' && (
          <div className="space-y-2.5">
            {notes.length === 0 ? (
              <p className="text-xs text-surface-400 text-center py-6">
                No notes saved. Speak "Note cheyyu..." to save a note.
              </p>
            ) : (
              notes.map((n) => (
                <div
                  key={n.id}
                  className="bg-surface-100/50 border border-surface-200/50 rounded-2xl p-4 flex items-start justify-between shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary-500/20 text-primary-300 flex items-center justify-center text-base shrink-0 mt-0.5">
                      📝
                    </div>
                    <div>
                      <p className="text-xs text-surface-900 font-medium leading-relaxed">
                        "{n.content}"
                      </p>
                      <p className="text-[10px] text-surface-400 mt-1 font-medium">
                        {new Date(n.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteNote(n.id)}
                    className="text-surface-400 hover:text-red-400 p-1.5 cursor-pointer shrink-0"
                    title="Delete Note"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
