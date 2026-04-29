import {experimental_AstroContainer as AstroContainer} from 'astro/container'
import {expect, test} from 'vitest'
import BaseLayout from './BaseLayout.astro'

const container = await AstroContainer.create()

test('BaseLayout renders title prop suffixed with site name', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'About'},
  })
  expect(html).toContain('<title>About | djf.io</title>')
})

test('BaseLayout uses provided description in meta tag', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x', description: 'A custom description'},
  })
  expect(html).toMatch(/<meta name="description" content="A custom description"/)
})

test('BaseLayout falls back to default description when omitted', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
  })
  expect(html).toMatch(/<meta name="description" content="Personal blog of David J Felix"/)
})

test('BaseLayout renders nav links to home, blog, github, twitter', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
  })
  expect(html).toMatch(/href="\/"/)
  expect(html).toMatch(/href="\/blog"/)
  expect(html).toMatch(/href="https:\/\/github\.com\/davidjfelix"/)
  expect(html).toMatch(/href="https:\/\/twitter\.com\/davidjfelix"/)
})

test('BaseLayout renders default slot content inside <main>', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
    slots: {default: '<p data-test="slot-content">hi</p>'},
  })
  expect(html).toContain('<p data-test="slot-content">hi</p>')
})

test('BaseLayout renders current year in footer', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
  })
  expect(html).toContain(String(new Date().getFullYear()))
})
