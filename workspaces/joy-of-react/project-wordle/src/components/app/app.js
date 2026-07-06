import React from 'react'

import Game from '../game'
import Header from '../header'

function App() {
  return (
    <div className="wrapper">
      <Header />

      <div className="game-wrapper">
        <Game />
      </div>
    </div>
  )
}

export default App
