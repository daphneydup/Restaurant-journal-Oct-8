import type { ComponentProps } from 'react'
import { Link } from 'react-router'
import { buttonStyles, type ButtonSize, type ButtonVariant } from './button-styles'

type StyleProps = { variant?: ButtonVariant; size?: ButtonSize }

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...rest
}: ComponentProps<'button'> & StyleProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...rest} />
}

/** A react-router link that looks like a button (navigation, not an action). */
export function ButtonLink({
  variant,
  size,
  className,
  ...rest
}: ComponentProps<typeof Link> & StyleProps) {
  return <Link className={buttonStyles({ variant, size, className })} {...rest} />
}
