import React from 'react';

import Toast from '../Toast';
import { ToastContext } from '../ToastProvider';
import styles from './ToastShelf.module.css';

function ToastShelf() {
  const {toasts, onCloseToast} = React.useContext(ToastContext);

  return (
    <ol className={styles.wrapper}>
      {toasts.map(({id, variant, message}) => (
        <li key={`toast-${id}`} className={styles.toastWrapper}>
          <Toast variant={variant} onClose={()=>onCloseToast(id)}>{message}</Toast>
        </li>
      ))}
    </ol>
  );
}

export default ToastShelf;
