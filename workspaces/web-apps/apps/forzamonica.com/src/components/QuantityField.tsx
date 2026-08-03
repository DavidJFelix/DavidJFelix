import {NumberInput} from '@ark-ui/react/number-input'

import {quantityField} from 'styled-system/recipes'

type QuantityFieldProps = {
  label?: string
  value: number
  min?: number
  disabled?: boolean
  onValueChange: (value: number) => void
}

export function QuantityField({
  label,
  value,
  min = 0,
  disabled,
  onValueChange,
}: QuantityFieldProps) {
  const classes = quantityField()
  return (
    <NumberInput.Root
      className={classes.root}
      value={String(value)}
      min={min}
      disabled={disabled}
      onValueChange={(details) => {
        if (!Number.isNaN(details.valueAsNumber)) {
          onValueChange(details.valueAsNumber)
        }
      }}
    >
      {label ? <NumberInput.Label className={classes.label}>{label}</NumberInput.Label> : null}
      <NumberInput.Control className={classes.control}>
        <NumberInput.DecrementTrigger className={classes.decrementTrigger}>
          &minus;
        </NumberInput.DecrementTrigger>
        <NumberInput.Input className={classes.input} />
        <NumberInput.IncrementTrigger className={classes.incrementTrigger}>
          +
        </NumberInput.IncrementTrigger>
      </NumberInput.Control>
    </NumberInput.Root>
  )
}
