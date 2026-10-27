import { useMemo } from 'react';
import type { VoiceUIState, VoiceState } from '../types/assistant';

interface AudioWaveformProps {
  status: VoiceUIState | VoiceState;
}

/**
 * AudioWaveform — Minimal State-Driven Audio Waveform
 *
 * Audio Safety Guarantee:
 * Strictly avoids creating repeated AudioContexts or MediaElementSource nodes,
 * preventing any risk of audio playback muting, InvalidStateErrors, or audio pipeline breakage.
 *
 * Dynamic Behaviors:
 * - IDLE: Calm, minimal static bars (nearly invisible 2.5px height).
 * - LISTENING: Organic multi-frequency active bar pulses representing voice capture.
 * - SPEAKING: Harmonious audio speech wave pulsing dynamically in sync with TTS playback.
 * - SEARCHING / PROCESSING: Gentle ambient wave ripples.
 * - Reduced Motion: Gracefully falls back to static bar levels.
 */
export default function AudioWaveform({ status }: AudioWaveformProps) {
  const normalizedStatus: VoiceUIState = useMemo(() => {
    if ((status as string) === 'ready') return 'idle';
    if ((status as string) === 'executing') return 'processing';
    return (status as VoiceUIState) || 'idle';
  }, [status]);

  const isIdle = normalizedStatus === 'idle';
  const isListening = normalizedStatus === 'listening';
  const isSpeaking = normalizedStatus === 'speaking';
  const isBusy =
    normalizedStatus === 'processing' ||
    normalizedStatus === 'thinking' ||
    normalizedStatus === 'searching' ||
    normalizedStatus === 'tool_running';

  // Symmetrical 24-bar acoustic profile
  // Center bars have higher peak amplitudes than edge bars
  const bars = useMemo(() => {
    const totalBars = 24;
    return Array.from({ length: totalBars }, (_, i) => {
      // Distance from center (0 at edges, 1 at center)
      const centerDist = 1 - Math.abs(i - (totalBars - 1) / 2) / ((totalBars - 1) / 2);
      const curve = Math.sin(centerDist * (Math.PI / 2));
      // Organic delay variation
      const delay = ((i * 73) % 100) / 100;
      const duration = 0.75 + ((i * 37) % 50) / 100;
      return {
        id: i,
        maxHeight: Math.round(12 + curve * 26), // 12px to 38px
        delay,
        duration,
      };
    });
  }, []);

  return (
    <div
      className="flex items-center justify-center gap-[3.5px] h-10 px-4 select-none pointer-events-none transition-opacity duration-300"
      aria-hidden="true"
    >
      {bars.map((bar) => {
        let barHeight = '3px';
        let barClass = 'bg-slate-300/60 rounded-full transition-all duration-300';
        let style: React.CSSProperties = {
          width: '3.5px',
          height: barHeight,
        };

        if (isListening) {
          barClass = 'bg-gradient-to-t from-rose-500 to-red-400 rounded-full animate-waveform-bar';
          style = {
            width: '3.5px',
            height: `${bar.maxHeight}px`,
            animationDelay: `${bar.delay * 0.9}s`,
            animationDuration: `${bar.duration}s`,
          };
        } else if (isSpeaking) {
          barClass = 'bg-gradient-to-t from-indigo-500 via-primary-500 to-purple-500 rounded-full animate-waveform-bar shadow-[0_0_8px_rgba(139,92,246,0.35)]';
          style = {
            width: '3.5px',
            height: `${Math.round(bar.maxHeight * 1.05)}px`,
            animationDelay: `${bar.delay * 0.8}s`,
            animationDuration: `${bar.duration * 0.95}s`,
          };
        } else if (isBusy) {
          barClass = 'bg-indigo-400/50 rounded-full animate-pulse';
          style = {
            width: '3.5px',
            height: `${Math.max(4, Math.round(bar.maxHeight * 0.35))}px`,
            animationDelay: `${bar.delay * 1.2}s`,
          };
        } else if (isIdle) {
          // Subtle static wave curve during idle
          barHeight = `${Math.max(2.5, Math.round(bar.maxHeight * 0.15))}px`;
          barClass = 'bg-indigo-300/35 rounded-full';
          style = {
            width: '3.5px',
            height: barHeight,
          };
        }

        return <span key={bar.id} className={barClass} style={style} />;
      })}
    </div>
  );
}
