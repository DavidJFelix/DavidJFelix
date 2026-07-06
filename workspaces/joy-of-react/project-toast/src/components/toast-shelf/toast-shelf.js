import React from 'react'

import Toast from '../toast'
import {ToastContext} from '../toast-provider'
import styles from './toast-shelf.module.css'

function ToastShelf() {
  const {toasts, onCloseToast} = React.useContext(ToastContext)

  return (
    <section aria-live="polite" aria-label="Notifications">
      <ol className={styles.wrapper}>
        {toasts.map(({id, variant, message}) => (
          <li key={`toast-${id}`} className={styles.toastWrapper}>
            <Toast variant={variant} onClose={() => onCloseToast(id)}>
              {message}
            </Toast>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default ToastShelf
