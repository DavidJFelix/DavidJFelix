import React from 'react';

import Button from '../Button';
import ToastShelf from '../ToastShelf';

import styles from './ToastPlayground.module.css';

const VARIANT_OPTIONS = ['notice', 'warning', 'success', 'error'];

function ToastPlayground() {
  const  [message, setMessage] = React.useState('');
  const [variant, setVariant] = React.useState('notice');
  const [toasts, setToasts] = React.useState([]);

  const onPopToast = React.useCallback(() => {
    setMessage('');
    setVariant('notice');
    setToasts((currentToasts) => {
      return [
        ...currentToasts,
        {
          id: crypto.randomUUID(),
          message,
          variant,
        },
      ];
    })
  }, [setToasts, variant, message, setVariant, setMessage]);
  const onCloseToast = React.useCallback((id) => {
    setToasts((currentToasts) => {
      return currentToasts.filter((toast) => toast.id !== id);
    })
  }, [setToasts]);

  return (
    <div className={styles.wrapper}>
      <header>
        <img alt="Cute toast mascot" src="/toast.png" />
        <h1>Toast Playground</h1>
      </header>

      <ToastShelf toasts={toasts} onCloseToast={onCloseToast}/>

      <form className={styles.controlsWrapper} onSubmit={(e) => {
        e.preventDefault();
        onPopToast();
      }}>
        <div className={styles.row}>
          <label
            htmlFor="message"
            className={styles.label}
            style={{ alignSelf: 'baseline' }}
          >
            Message
          </label>
          <div className={styles.inputWrapper}>
            <textarea id="message" className={styles.messageInput} value={message} onChange={(event) => setMessage(event.target.value)}/>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.label}>Variant</div>
          <div
            className={`${styles.inputWrapper} ${styles.radioWrapper}`}
          >
            {VARIANT_OPTIONS.map((option) => (
              <label key={option} htmlFor={`variant-${option}`}>
                <input
                  id={`variant-${option}`}
                  type="radio"
                  name="variant"
                  value={option}
                  checked={variant === option}
                  onChange={() => setVariant(option)}
                />
                {option}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.label} />
          <div
            className={`${styles.inputWrapper} ${styles.radioWrapper}`}
          >
            <Button type="submit">Pop Toast!</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default ToastPlayground;
