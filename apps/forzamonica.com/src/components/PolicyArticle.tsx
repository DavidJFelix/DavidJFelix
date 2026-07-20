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
        py: '14',
        px: '6',
        mx: 'auto',
        maxWidth: '780px',
        width: 'full',
        '& p': {color: 'ink.muted', lineHeight: '1.6'},
      })}
    >
      <h1 className={css({textStyle: 'displayLg', color: 'ink'})}>{title}</h1>
      {children}
    </article>
  )
}
