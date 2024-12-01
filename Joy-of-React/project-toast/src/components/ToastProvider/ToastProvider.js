import React from 'react';
import useEscapeKey from '../../hooks/use-escape-key';

export const ToastContext = React.createContext();

function ToastProvider({children}) {
  const [toasts, setToasts] = React.useState([]);

  const onCloseToast = React.useCallback((id) => {
    setToasts((currentToasts) => {
      return currentToasts.filter((toast) => toast.id !== id);
    });
  }, [setToasts]);

  const popToast = React.useCallback((message, variant) => {
    setToasts((currentToasts) => {
      return [
        ...currentToasts,
        {
          id: crypto.randomUUID(),
          message,
          variant,
        },
      ];
    });
  }, [setToasts]);

  useEscapeKey(() => {
    setToasts([]);
  });

  return (
    <ToastContext.Provider value={{toasts, onCloseToast, popToast}}>
      {children}
    </ToastContext.Provider>
  );
}

export default ToastProvider;
