import { useMemo } from 'react';
import type { VoiceUIState, VoiceState } from '../types/assistant';

interface StatusIndicatorProps {
  status: VoiceUIState | VoiceState;
}

const statusLabels: Record<VoiceUIState, string> = {
  idle: 'Ready to listen',
  listening: 'Listening…',
  processing: 'Processing…',
  thinking: 'Thinking…',
  searching: 'Searching web…',
  tool_running: 'Executing action…',
  speaking: 'VAANI is speaking…',
  error: 'Error occurred',
  retry: 'Tap to retry',
};

const dotColors: Record<VoiceUIState, string> = {
  idle: 'bg-emerald-400',
  listening: 'bg-red-500 animate-pulse',
  processing: 'bg-amber-400 animate-bounce',
  thinking: 'bg-amber-400 animate-bounce',
  searching: 'bg-sky-400 animate-pulse',
  tool_running: 'bg-cyan-400 animate-spin',
  speaking: 'bg-primary-400 animate-pulse',
  error: 'bg-red-500',
  retry: 'bg-amber-400',
};

export default function StatusIndicator({ status }: StatusIndicatorProps) {
  const normalizedStatus: VoiceUIState = useMemo(() => {
    if ((status as string) === 'ready') return 'idle';
    if ((status as string) === 'executing') return 'processing';
    return (status as VoiceUIState) || 'idle';
  }, [status]);

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <span
        className={`w-1.5 h-1.5 rounded-full ${dotColors[normalizedStatus]} ${
          normalizedStatus !== 'idle' ? 'status-blink' : ''
        }`}
      />
      <span className="text-[11px] text-surface-400 font-medium">
        {statusLabels[normalizedStatus]}
      </span>
    </div>
  );
}
