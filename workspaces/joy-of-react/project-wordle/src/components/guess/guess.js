import React from 'react'
import {range} from '../../utils'

const emptyGuessStatus = []

function Guess({guess = '', guessStatus = emptyGuessStatus}) {
  const letterSlots = range(5)

  return (
    <p className="guess">
      {letterSlots.map((letterSlot) => {
        const status = guessStatus[letterSlot]?.status ?? ''
        return (
          <span key={letterSlot} className={`cell ${status}`}>
            {guess[letterSlot]}
          </span>
        )
      })}
    </p>
  )
}

export default Guess
