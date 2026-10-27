import type { QuickAction } from '../types/assistant';
import { actionService } from '../services/actionService';

interface QuickActionsProps {
  onActionVoiceQuery: (query: string, response: string) => void;
  disabled?: boolean;
}

export default function QuickActions({
  onActionVoiceQuery,
  disabled = false,
}: QuickActionsProps) {
  const actions = actionService.getAvailableActions();

  const handleClick = async (action: QuickAction) => {
    if (disabled) return;
    const response = await actionService.executeAction(action);
    onActionVoiceQuery(action.demoQuery, response);
  };

  return (
    <div className="px-4 py-2">
      <p className="text-[10px] text-surface-400 uppercase tracking-wider mb-2 font-semibold text-center">
        Quick Voice Prompts
      </p>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {actions.map((action) => (
          <button
            key={action.id}
            id={`quick-action-${action.id}`}
            onClick={() => handleClick(action)}
            disabled={disabled}
            className="flex items-center gap-1.5 bg-surface-100/70 hover:bg-surface-200/80 active:scale-95 text-surface-800 text-xs font-medium px-3.5 py-2 rounded-xl whitespace-nowrap transition-all cursor-pointer border border-surface-200/50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-sm">{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
