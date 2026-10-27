import { useState } from 'react';
import type { AIAnalysis as AIAnalysisType } from '../types/assistant';

interface AIAnalysisProps {
  analysis: AIAnalysisType | null;
}

export default function AIAnalysis({ analysis }: AIAnalysisProps) {
  const [open, setOpen] = useState(false);

  const data = analysis ?? {
    language: 'Malayalam + English',
    intent: 'General',
    emotion: 'Neutral',
    confidence: 0,
    action: '—',
    contextStatus: 'Idle' as const,
  };

  return (
    <div className="px-4 py-1">
      <button
        id="ai-analysis-toggle"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 text-[11px] text-surface-400 hover:text-surface-500 transition-colors cursor-pointer bg-transparent border-none p-0"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        AI Analysis
      </button>

      {open && (
        <div className="mt-2 bg-surface-50 border border-surface-100 rounded-xl p-3 animate-fade-in-up">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <Row label="Language" value={data.language} />
            <Row label="Intent" value={data.intent} />
            <Row label="Emotion" value={data.emotion} />
            <Row
              label="Confidence"
              value={data.confidence > 0 ? `${data.confidence}%` : '—'}
              highlight={data.confidence >= 90}
            />
            <Row label="Action" value={data.action} />
            <Row
              label="Context"
              value={data.contextStatus}
              highlight={data.contextStatus === 'Active'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-surface-400">{label}</span>
      <span
        className={`font-medium ${
          highlight ? 'text-accent' : 'text-surface-700'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
