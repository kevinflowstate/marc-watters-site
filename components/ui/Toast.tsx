"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  toast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const colorMap = {
    success: "border-emerald-500/20 bg-emerald-500/10",
    error: "border-red-500/20 bg-red-500/10",
    info: "border-accent/20 bg-accent/10",
  };

  const iconMap = {
    success: "M5 13l4 4L19 7",
    error: "M6 18L18 6M6 6l12 12",
    info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  };

  const iconColor = {
    success: "text-emerald-400",
    error: "text-red-400",
    info: "text-accent-bright",
  };

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-lg transition-all duration-300 ${colorMap[toast.type]} ${
        visible && !exiting ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
      }`}
    >
      <svg className={`w-4 h-4 flex-shrink-0 ${iconColor[toast.type]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconMap[toast.type]} />
      </svg>
      <span className="text-sm text-text-primary">{toast.message}</span>
      <button
        onClick={() => { setExiting(true); setTimeout(() => onDismiss(toast.id), 300); }}
        className="ml-2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
