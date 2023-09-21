import React from 'react';
import { range } from '../../utils';

function Guess({guess = ""}) {
  const letterSlots = range(5)
  
  return <p className="guess">
    {letterSlots.map(letterSlot => (
      <span key={letterSlot} className="cell">{guess[letterSlot]}</span>
    ))}  
  </p>
}

export default Guess;
