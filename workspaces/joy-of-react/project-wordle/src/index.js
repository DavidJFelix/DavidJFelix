import React from 'react'
import {createRoot} from 'react-dom/client'

import App from './components/app'

import './reset.css'
import './styles.css'

const root = createRoot(document.querySelector('#root'))
root.render(<App />)
