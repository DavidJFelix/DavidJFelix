import {experimental_AstroContainer as AstroContainer} from 'astro/container'
import {beforeAll, describe, expect, test} from 'vitest'
import BaseLayout from './BaseLayout.astro'

let container: AstroContainer

beforeAll(async () => {
  container = await AstroContainer.create()
})

describe('BaseLayout', () => {
  test('renders title prop suffixed with site name', async () => {
    const html = await container.renderToString(BaseLayout, {
      props: {title: 'About'},
    })
    expect(html).toContain('<title>About | djf.io</title>')
  })

  test('uses provided description in meta tag', async () => {
    const html = await container.renderToString(BaseLayout, {
      props: {title: 'x', description: 'A custom description'},
    })
    expect(html).toMatch(/<meta name="description" content="A custom description"/)
  })

  test('falls back to default description when omitted', async () => {
    const html = await container.renderToString(BaseLayout, {
      props: {title: 'x'},
    })
    expect(html).toMatch(/<meta name="description" content="Personal blog of David J Felix"/)
  })

  test('renders nav links to home, blog, github, twitter', async () => {
    const html = await container.renderToString(BaseLayout, {
      props: {title: 'x'},
    })
    expect(html).toMatch(/href="\/"/)
    expect(html).toMatch(/href="\/blog"/)
    expect(html).toMatch(/href="https:\/\/github\.com\/davidjfelix"/)
    expect(html).toMatch(/href="https:\/\/twitter\.com\/davidjfelix"/)
  })

  test('renders default slot content inside <main>', async () => {
    const html = await container.renderToString(BaseLayout, {
      props: {title: 'x'},
      slots: {default: '<p data-test="slot-content">hi</p>'},
    })
    expect(html).toContain('<p data-test="slot-content">hi</p>')
  })

  test('renders current year in footer', async () => {
    const html = await container.renderToString(BaseLayout, {
      props: {title: 'x'},
    })
    expect(html).toContain(String(new Date().getFullYear()))
  })
})
