import {css} from 'styled-system/css'

// Shared shell for the policy stub pages. Real policy copy comes from the
// Shopify store once it exists (issue #222); until then each page states its
// placeholder terms plainly.
export function PolicyArticle({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <article
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        py: '12',
        maxWidth: 'prose',
        '& p': {color: 'fg.muted'},
      })}
    >
      <h1 className={css({fontSize: '3xl', fontWeight: 'bold', letterSpacing: 'tight'})}>
        {title}
      </h1>
      {children}
    </article>
  )
}
