import React from 'react'

import styles from './button.module.css'

function Button({className = '', ...delegated}) {
  return <button className={`${styles.button} ${className}`} {...delegated} />
}

export default Button
