import React from 'react'

import Toast from '../toast'
import {ToastContext} from '../toast-provider'
import styles from './toast-shelf.module.css'

function ToastShelf() {
  const {toasts, onCloseToast} = React.useContext(ToastContext)

  return (
    <ol className={styles.wrapper} role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map(({id, variant, message}) => (
        <li key={`toast-${id}`} className={styles.toastWrapper}>
          <Toast variant={variant} onClose={() => onCloseToast(id)}>
            {message}
          </Toast>
        </li>
      ))}
    </ol>
  )
}

export default ToastShelf
