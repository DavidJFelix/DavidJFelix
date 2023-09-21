import React from 'react';
import { NUM_OF_GUESSES_ALLOWED } from '../../constants';
import { range } from '../../utils';
import Guess from '../Guess';

function GuessResults({guesses}) {
  const guessSlots = range(NUM_OF_GUESSES_ALLOWED)

  return (
    <div className="guess-results">
      {guessSlots.map((guessSlot) => (
        <Guess key={guessSlot} guess={guesses[guessSlot]}/>
      ))}
    </div>
  )
}

export default GuessResults;
