import {Fragment} from 'react'
import {css, cva} from 'styled-system/css'
import {bitsByByte, type Uint8ArrayOfLength} from '../lib/bits'

interface BitViewProps<L extends number> {
  bigEndianBytes: Uint8ArrayOfLength<L>
  // Defaults to every bit; see bitsByByte.
  lsbBitMask?: Uint8ArrayOfLength<NoInfer<L>>
}

const row = css({display: 'flex', flexWrap: 'wrap', columnGap: '3', rowGap: '2', my: '6'})

const byteGroup = css({display: 'flex', gap: '0.5'})

const cell = cva({
  base: {
    display: 'grid',
    placeItems: 'center',
    w: '4',
    h: '5',
    borderRadius: 'xs',
    fontFamily: 'mono',
    fontSize: 'xs',
    lineHeight: 'none',
  },
  variants: {
    set: {
      true: {bg: 'text', color: 'bg.canvas'},
      false: {bg: 'bg.element', color: 'text.muted'},
    },
  },
})

const visuallyHidden = css({srOnly: true})

// A value's bits as a row of cells, most significant first, grouped by byte.
// Byte groups wrap as whole units on narrow screens.
export function BitView<L extends number>({bigEndianBytes, lsbBitMask}: BitViewProps<L>) {
  const byteGroups = bitsByByte({bigEndianBytes, lsbBitMask})
  const count = byteGroups.flat().length
  // Screen readers get the bits as text instead of the cells, with the digits
  // spaced so they are read one by one rather than as a single large number.
  const spoken = byteGroups.map((bits) => bits.map((bit) => bit.value).join(' ')).join(', ')
  const summary = `${count} ${count === 1 ? 'bit' : 'bits'}: ${spoken}.`

  // The space before each byte group takes no room in the flex row, but keeps
  // copied text and the markdown rendition for agents readable.
  return (
    <div className={row}>
      <span className={visuallyHidden}>{summary}</span>
      {byteGroups.map((bits) => (
        <Fragment key={bits[0].position}>
          {' '}
          <span aria-hidden="true" className={byteGroup}>
            {bits.map((bit) => (
              <span key={bit.position} className={cell({set: bit.value === 1})}>
                {bit.value}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </div>
  )
}
