import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface BannerMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

interface StatusBannerProps {
  message: BannerMessage | null;
  onDismiss?: () => void;
}

export function StatusBanner({ message, onDismiss }: StatusBannerProps) {
  if (!message) return null;

  const styles =
    message.type === 'success'
      ? 'border-[#BBDFCC] bg-[#EAF7F0] text-[#14532D]'
      : message.type === 'error'
        ? 'border-[#F5C2C2] bg-[#FEF2F2] text-[#991B1B]'
        : 'border-[#C5DCEF] bg-[#E8F3FB] text-[#10233F]';

  const Icon =
    message.type === 'success' ? CheckCircle2 : message.type === 'error' ? AlertCircle : Info;

  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-xs ${styles}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className="h-4.5 w-4.5 shrink-0" />
        <span className="leading-snug">{message.text}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 opacity-75 hover:opacity-100"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
