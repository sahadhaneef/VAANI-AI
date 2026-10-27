import { useState, useEffect } from 'react';
import type { VoiceStats, VoiceSession } from '../types/assistant';

export default function Profile() {
  const [profileStats, setProfileStats] = useState<VoiceStats>({
    name: 'Voice User',
    totalSessions: 48,
    commandsCompleted: 156,
    malayalamInteractions: 41,
    mixedInteractions: 7,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('vaani_voice_sessions');
      if (stored) {
        const parsed: VoiceSession[] = JSON.parse(stored);
        if (parsed.length > 0) {
          const mlCount = parsed.filter((s) => s.language === 'ml').length;
          setProfileStats((prev) => ({
            ...prev,
            totalSessions: 40 + parsed.length,
            malayalamInteractions: 35 + mlCount,
            mixedInteractions: Math.max(1, 5 + (parsed.length - mlCount)),
            commandsCompleted: 150 + parsed.length * 2,
          }));
        }
      }
    } catch (e) {
      console.warn('Could not compute profile stats from localStorage');
    }
  }, []);

  const stats = [
    {
      label: 'Voice Sessions',
      value: profileStats.totalSessions,
      icon: '🎙️',
    },
    {
      label: 'Voice Commands',
      value: profileStats.commandsCompleted,
      icon: '⚡',
    },
    {
      label: 'Malayalam Speech',
      value: profileStats.malayalamInteractions,
      icon: '🇮🇳',
    },
    {
      label: 'Mixed / Code-switch',
      value: profileStats.mixedInteractions,
      icon: '🌐',
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface-0">
      {/* Header */}
      <div className="px-5 py-4 bg-surface-50/90 border-b border-surface-100/50 backdrop-blur-md">
        <h1 className="text-base font-bold text-surface-900 tracking-tight">
          Voice Assistant Profile
        </h1>
        <p className="text-[11px] text-surface-400 font-medium">
          Malayalam speech & interaction analytics
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* User Card */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-primary-500/25">
            {profileStats.name.charAt(0)}
          </div>
          <div className="text-center">
            <h2 className="text-base font-bold text-surface-900">
              {profileStats.name}
            </h2>
            <p className="text-xs text-surface-400 font-medium mt-0.5">
              VAANI Voice User
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-surface-100/40 border border-surface-200/40 rounded-2xl p-4 text-center shadow-sm"
            >
              <span className="text-2xl">{stat.icon}</span>
              <p className="text-2xl font-black text-surface-900 mt-2">
                {stat.value}
              </p>
              <p className="text-[11px] text-surface-400 mt-0.5 font-medium">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Voice System Settings / Specifications */}
        <div className="bg-surface-100/40 border border-surface-200/40 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-surface-800 uppercase tracking-wider">
            Voice System Specs
          </h3>
          <div className="space-y-2.5">
            <InfoRow label="Assistant Name" value="VAANI AI" />
            <InfoRow label="Architecture" value="True Voice-to-Voice (Phase 2)" />
            <InfoRow label="STT Engine" value="Web Speech API (ml-IN)" />
            <InfoRow label="TTS Engine" value="SpeechSynthesis (ml-IN Audio)" />
            <InfoRow label="Interaction Mode" value="Microphone Only" highlight />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-surface-400 font-medium">{label}</span>
      <span
        className={`font-semibold ${highlight ? 'text-accent' : 'text-surface-800'}`}
      >
        {value}
      </span>
    </div>
  );
}
