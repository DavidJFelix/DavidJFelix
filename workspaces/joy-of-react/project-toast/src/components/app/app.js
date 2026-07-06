import React from 'react'

import Footer from '../footer'
import ToastPlayground from '../toast-playground'
import ToastProvider from '../toast-provider'

function App() {
  return (
    <ToastProvider>
      <ToastPlayground />
      <Footer />
    </ToastProvider>
  )
}

export default App
