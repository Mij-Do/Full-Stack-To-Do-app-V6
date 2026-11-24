'use client';

import { Toast as ToastPrimitive } from 'radix-ui';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; variant: ToastVariant };
type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const toastStyles: Record<ToastVariant, string> = {
  success: 'border-emerald-600/30 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50',
  error: 'border-destructive/40 bg-destructive text-destructive-foreground',
  info: 'border-border bg-popover text-popover-foreground',
};

const ToastIcon = ({ variant }: { variant: ToastVariant }) => {
  const Icon = variant === 'success' ? CircleCheck : variant === 'error' ? CircleAlert : Info;
  return <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />;
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const nextId = useRef(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((variant: ToastVariant, message: string) => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, message, variant }].slice(-4));
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const api = useMemo<ToastApi>(() => ({
    success: (message) => show('success', message),
    error: (message) => show('error', message),
    info: (message) => show('info', message),
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      <ToastPrimitive.Provider duration={4000} label="Notifications" swipeDirection="up">
        {children}
        {toasts.map(({ id, message, variant }) => (
          <ToastPrimitive.Root
            key={id}
            type={variant === 'error' ? 'foreground' : 'background'}
            className={cn(
              'flex w-full items-start gap-3 rounded-xl border p-4 shadow-lg outline-none',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              toastStyles[variant],
            )}
            onOpenChange={(open) => {
              if (!open) dismiss(id);
            }}
          >
            <ToastIcon variant={variant} />
            <ToastPrimitive.Title className="min-w-0 flex-1 break-words text-sm font-medium leading-5">
              {message}
            </ToastPrimitive.Title>
            <ToastPrimitive.Close
              aria-label="Dismiss notification"
              className="-mr-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md opacity-75 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden="true" className="size-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport
          label="Notifications"
          role="region"
          aria-label="Notifications"
          aria-live="polite"
          className={cn(
            'fixed top-4 left-1/2 z-[100] flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 overflow-y-auto outline-none',
            'sm:left-auto sm:right-4 sm:translate-x-0',
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used within ToastProvider.');
  return toast;
}
