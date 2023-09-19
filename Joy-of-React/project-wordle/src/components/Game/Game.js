import React from 'react';

import { WORDS } from '../../data';
import { sample } from '../../utils';
import GuessInput from '../GuessInput';
import GuessResults from '../GuessResults';

// Pick a random word on every pageload.
const answer = sample(WORDS);
// To make debugging easier, we'll log the solution in the console.
console.info({ answer });

function Game() {
  const [guesses, setGuesses] = React.useState([])
  const appendGuess = React.useCallback((newGuess) => {
    setGuesses((guesses) => [...guesses, newGuess])
  }, [setGuesses])

  return <>
    <GuessResults guesses={guesses} />
    <GuessInput onSubmit={appendGuess} />
  </>;
}

export default Game;
