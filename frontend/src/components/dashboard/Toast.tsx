export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

export default function Toast({ toast, onClose }: ToastProps) {
  const colors = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    error: "border-red-500/30 bg-red-500/10 text-red-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    info: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  };

  return (
    <div className={`rounded-lg border px-4 py-3 shadow-lg ${colors[toast.type]}`}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm">{toast.message}</span>
        <button type="button" onClick={() => onClose(toast.id)} className="text-xs opacity-70 hover:opacity-100">
          Close
        </button>
      </div>
    </div>
  );
}
