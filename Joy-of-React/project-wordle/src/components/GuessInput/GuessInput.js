import React from 'react';

const matchNotUppercaseAlphabetRegex =  /[^A-Z]/g
const validGuessRegex = "[A-Z]{5}"


function GuessInput() {
  const [guess, setGuess] = React.useState('');
  const onGuessChange = React.useCallback((event) => {
    const nextGuess = event
      .target
      .value
      .toUpperCase()
      .replaceAll(matchNotUppercaseAlphabetRegex, "")
      .slice(0,5)
    setGuess(nextGuess);
  }, [setGuess])
  const onGuessSubmit = React.useCallback((event) => {
    event.preventDefault();
    if (guess.length !== 5) {
      return
    }

    console.log(guess);
    setGuess('')
  }, [guess]);

  return (
    <form className="guess-input-wrapper" onSubmit={onGuessSubmit}>
      <label htmlFor="guess-input">Enter guess:</label>
      <input
        required
        minLength={5}
        maxLength={5}
        pattern={validGuessRegex}
        id="guess-input"
        title="5 letter word"
        type="text"
        value={guess}
        onChange={onGuessChange}
      />
    </form>
  )
}

export default GuessInput;
