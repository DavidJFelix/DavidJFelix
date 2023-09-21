import React from 'react';
import { NUM_OF_GUESSES_ALLOWED } from '../../constants';
import { checkGuess } from '../../game-helpers';
import { range } from '../../utils';
import Guess from '../Guess';

function GuessResults({guesses, answer}) {
  const guessSlots = range(NUM_OF_GUESSES_ALLOWED)

  return (
    <div className="guess-results">
      {guessSlots.map((guessSlot) => {
        const guess = guesses[guessSlot];
        const guessStatus = checkGuess(guess, answer) ?? [];
        console.log(guess, answer, guessStatus)
        return (
          <Guess key={guessSlot} guess={guess} guessStatus={guessStatus}/>
        )
      })}
    </div>
  )
}

export default GuessResults;
