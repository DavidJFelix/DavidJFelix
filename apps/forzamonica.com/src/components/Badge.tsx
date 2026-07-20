import {type BadgeVariantProps, badge} from 'styled-system/recipes'

type BadgeProps = BadgeVariantProps & {children: React.ReactNode}

export function Badge({tone, children}: BadgeProps) {
  return <span className={badge({tone})}>{children}</span>
}
