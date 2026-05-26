import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

const TOAST_STYLES = {
  error: {
    border: 'var(--error-color)',
    background: 'rgba(239, 68, 68, 0.12)',
    color: 'var(--error-color)',
  },
  success: {
    border: 'var(--success-color)',
    background: 'rgba(34, 197, 94, 0.12)',
    color: 'var(--success-color)',
  },
  info: {
    border: 'var(--border-color)',
    background: 'var(--surface-color)',
    color: 'var(--text-primary)',
  },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message, options = {}) => {
    const { type = 'error', duration = 4500 } = options;
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 20000,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: 'min(360px, calc(100vw - 48px))',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(toast => {
          const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
          return (
            <div
              key={toast.id}
              role="status"
              style={{
                pointerEvents: 'auto',
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: 600,
                lineHeight: 1.45,
                border: `1px solid ${style.border}`,
                backgroundColor: style.background,
                color: style.color,
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                animation: 'toastIn 0.25s ease-out',
              }}
            >
              {toast.message}
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
