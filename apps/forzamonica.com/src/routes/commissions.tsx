import {createFileRoute} from '@tanstack/react-router'
import {useId, useState} from 'react'

import {css, cx} from 'styled-system/css'
import {card, field} from 'styled-system/recipes'

import {Button} from '@/components/Button.tsx'
import {SelectField} from '@/components/SelectField.tsx'

export const Route = createFileRoute('/commissions')({
  head: () => ({meta: [{title: 'Commissions — forzamonica art'}]}),
  component: CommissionsPage,
})

const STEPS = [
  ['1', 'You write to me', 'A few sentences and a photo or two is plenty.'],
  ['2', 'I sketch and quote', 'Small pieces start around $150. You approve before I paint.'],
  ['3', 'I paint and ship', 'Usually 2–3 weeks, flat-packed with care instructions.'],
] as const

const PIECE_KINDS = ['Portrait', 'Landscape', 'Pet', 'Something else'] as const

const SIZES = [
  'Small (up to 8 × 10 in)',
  'Medium (11 × 14 in)',
  'Large (16 × 20 in)',
  'Not sure yet',
] as const

// White checkmark for the checked checkbox; native inputs cannot render
// pseudo-element content.
const CHECKMARK_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 6.5 5 9.5 10 3' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`

const choiceLabel = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2.5',
  fontSize: '15px',
  color: 'ink',
  cursor: 'pointer',
  userSelect: 'none',
})

const radioInput = css({
  appearance: 'none',
  width: '5',
  height: '5',
  borderRadius: 'full',
  flexShrink: '0',
  border: '1.5px solid',
  borderColor: 'border.strong',
  bg: 'surface',
  cursor: 'pointer',
  transition: 'border token(durations.quick) token(easings.out)',
  _checked: {border: '6.5px solid', borderColor: 'ink'},
})

const checkboxInput = css({
  appearance: 'none',
  width: '5',
  height: '5',
  borderRadius: '6px',
  flexShrink: '0',
  border: '1.5px solid',
  borderColor: 'border.strong',
  bg: 'surface',
  cursor: 'pointer',
  transition: 'background token(durations.quick) token(easings.out)',
  _checked: {
    bg: 'ink',
    borderColor: 'ink',
    backgroundImage: CHECKMARK_SVG,
    backgroundSize: '12px',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  },
})

function CommissionsPage() {
  return (
    <div className={css({maxWidth: 'page', mx: 'auto', px: '6', pt: '14', pb: '6'})}>
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: {base: '1fr', md: '1fr 1.2fr'},
          gap: {base: '10', md: '14'},
          alignItems: 'start',
        })}
      >
        <div className={css({display: 'flex', flexDirection: 'column', gap: '5'})}>
          <h1 className={css({textStyle: 'displayXl', color: 'ink'})}>Let's paint your idea</h1>
          <p className={css({fontSize: '16px', lineHeight: '1.6', color: 'ink.muted'})}>
            I take a handful of commissions each month — portraits of places, pets, and the
            occasional wedding bouquet. Tell me what you're imagining and I'll write back within 2
            days with a sketch plan and a quote.
          </p>
          <ol
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '3.5',
              listStyle: 'none',
            })}
          >
            {STEPS.map(([number, title, detail]) => (
              <li
                key={number}
                className={css({display: 'flex', gap: '3.5', alignItems: 'flex-start'})}
              >
                <span
                  className={css({
                    width: '7',
                    height: '7',
                    borderRadius: 'full',
                    bg: 'pigment.butter',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    flexShrink: '0',
                  })}
                >
                  {number}
                </span>
                <div>
                  <p className={css({fontSize: '14px', fontWeight: 'bold', color: 'ink'})}>
                    {title}
                  </p>
                  <p className={css({fontSize: '13px', color: 'ink.muted', mt: '0.5'})}>{detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className={cx(card(), css({p: '7'}))}>
          <CommissionForm />
        </div>
      </div>
    </div>
  )
}

// Front-end only for now: there is no inquiry backend yet, so "sent" is a
// local state. Wire this to real delivery before launch.
function CommissionForm() {
  const [sent, setSent] = useState(false)
  const fieldClasses = field()
  const ideaHintId = useId()

  if (sent) {
    return (
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '3',
          alignItems: 'flex-start',
        })}
      >
        <h2 className={css({textStyle: 'displayMd', color: 'ink'})}>Got it — thank you!</h2>
        <p className={css({fontSize: '15px', lineHeight: '1.6', color: 'ink.muted'})}>
          Your note is in my inbox. I'll write back within 2 days — keep an eye out for an email
          from monica@forzamonica.art.
        </p>
        <Button visual="secondary" size="sm" onClick={() => setSent(false)}>
          Send another
        </Button>
      </div>
    )
  }

  return (
    <form
      className={css({display: 'flex', flexDirection: 'column', gap: '4.5'})}
      onSubmit={(event) => {
        event.preventDefault()
        setSent(true)
      }}
    >
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: {base: '1fr', sm: '1fr 1fr'},
          gap: '4',
        })}
      >
        <label className={fieldClasses.root}>
          <span className={fieldClasses.label}>Your name</span>
          <input type="text" name="name" placeholder="Jane Doe" className={fieldClasses.control} />
        </label>
        <label className={fieldClasses.root}>
          <span className={fieldClasses.label}>Email</span>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            className={fieldClasses.control}
          />
        </label>
      </div>
      <fieldset className={css({display: 'flex', flexDirection: 'column', gap: '2'})}>
        <legend className={cx(fieldClasses.label, css({mb: '2'}))}>What kind of piece?</legend>
        <div className={css({display: 'flex', gap: '5', flexWrap: 'wrap'})}>
          {PIECE_KINDS.map((kind) => (
            <label key={kind} className={choiceLabel}>
              <input
                type="radio"
                name="piece-kind"
                value={kind}
                defaultChecked={kind === 'Landscape'}
                className={radioInput}
              />
              {kind}
            </label>
          ))}
        </div>
      </fieldset>
      <SelectField label="Rough size" name="size">
        {SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </SelectField>
      <label className={fieldClasses.root}>
        <span className={fieldClasses.label}>Tell me about your idea</span>
        <textarea
          name="idea"
          rows={5}
          placeholder="I'd love a painting of…"
          aria-describedby={ideaHintId}
          className={cx(fieldClasses.control, css({resize: 'vertical', lineHeight: '1.5'}))}
        />
        <span id={ideaHintId} className={fieldClasses.hint}>
          Colors, mood, occasion — anything helps. You can email photos after.
        </span>
      </label>
      <label className={choiceLabel}>
        <input type="checkbox" name="gift-deadline" className={checkboxInput} />
        This is a gift with a deadline
      </label>
      <Button type="submit" className={css({alignSelf: 'flex-start'})}>
        Send to Monica
      </Button>
    </form>
  )
}
