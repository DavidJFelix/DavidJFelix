import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
} from 'react-feather';

import VisuallyHidden from '../VisuallyHidden';

import styles from './Toast.module.css';

const ICONS_BY_VARIANT = {
  notice: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: AlertOctagon,
};

function Toast({children="", variant="notice", onClose=() => {}}) {
  children = children ? children : "16 photos have been uploaded"
  const Icon = ICONS_BY_VARIANT[variant];
  const className = `${styles.toast} ${styles[variant]}`;

  return (
    <div className={className}>
      <div className={styles.iconContainer}>
        <Icon size={24} />
      </div>
      <p className={styles.content}>
        <VisuallyHidden>
          {variant} -
        </VisuallyHidden>
        {children}
      </p>
      <button
        className={styles.closeButton}
        onClick={onClose}
        aria-label="Dismiss message"
        aria-live="off"
        >
        <X size={24} />
      </button>
    </div>
  );
}

export default Toast;