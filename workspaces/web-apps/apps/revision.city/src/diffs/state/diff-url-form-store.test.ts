import {expect, test, vi} from 'vitest'

import {diffUrlFormLogic} from './diff-url-form-store'

const COMMITTED_URL = 'https://github.com/owner/repo/pull/7'

function createFormStore() {
  return diffUrlFormLogic.createStore({committedUrl: COMMITTED_URL})
}

type FormStore = ReturnType<typeof createFormStore>

test('the form starts on the committed URL', () => {
  expect(createFormStore().getSnapshot().context).toEqual({
    committedUrl: COMMITTED_URL,
    status: 'editing',
    url: COMMITTED_URL,
  })
})

test.each([
  {
    name: 'a GitHub URL',
    input: '  https://github.com/owner/repo/pull/8  ',
    location: {splat: 'owner/repo/pull/8'},
  },
  {
    name: 'a Codeberg URL',
    input: 'https://codeberg.org/forgejo/forgejo/pulls/15078',
    location: {domain: 'codeberg.org', splat: 'forgejo/forgejo/pulls/15078'},
  },
])('a submit of $name keeps the trimmed URL and emits its viewer location', ({input, location}) => {
  const store = createFormStore()
  const accepted = vi.fn<(event: unknown) => void>()
  store.on('accepted', accepted)
  store.trigger.changed({url: input})
  store.trigger.enterPressed()

  store.trigger.submitted()

  expect(accepted).toHaveBeenCalledWith({type: 'accepted', ...location})
  expect(store.getSnapshot().context).toMatchObject({status: 'editing', url: input.trim()})
})

test('a submit of a URL that the viewer cannot open shows the error and keeps the draft', () => {
  const store = createFormStore()
  const rejected = vi.fn<(event: unknown) => void>()
  store.on('rejected', rejected)
  store.trigger.changed({url: 'not a url'})

  store.trigger.submitted()

  expect(rejected).toHaveBeenCalledOnce()
  expect(store.getSnapshot().context).toMatchObject({status: 'invalid', url: 'not a url'})
})

test.each([
  {name: 'typing', send: (store: FormStore) => store.trigger.changed({url: 'a/b#9'}), url: 'a/b#9'},
  {name: 'Escape', send: (store: FormStore) => store.trigger.escaped(), url: COMMITTED_URL},
  {name: 'the clear button', send: (store: FormStore) => store.trigger.cleared(), url: ''},
])('$name clears the error', ({send, url}) => {
  const store = createFormStore()
  store.trigger.changed({url: 'not a url'})
  store.trigger.submitted()

  send(store)

  expect(store.getSnapshot().context).toMatchObject({status: 'editing', url})
})

test('a blur on an empty field restores the committed URL and clears the error', () => {
  const store = createFormStore()
  store.trigger.changed({url: '  '})
  store.trigger.submitted()

  store.trigger.blurred()

  expect(store.getSnapshot().context).toMatchObject({status: 'editing', url: COMMITTED_URL})
})

test('a blur keeps a draft', () => {
  const store = createFormStore()
  store.trigger.changed({url: 'owner/repo'})

  expect(store.can.blurred()).toBe(false)
})

test('the blur that Enter causes does not restore the committed URL before the submit', () => {
  const store = createFormStore()
  store.trigger.changed({url: ''})
  store.trigger.enterPressed()

  expect(store.can.blurred()).toBe(false)
  store.trigger.submitted()
  expect(store.getSnapshot().context).toMatchObject({status: 'invalid', url: ''})
})

test('typing after Enter without a submit lets a blur restore the committed URL again', () => {
  const store = createFormStore()
  store.trigger.enterPressed()

  store.trigger.changed({url: ''})

  expect(store.can.blurred()).toBe(true)
})
