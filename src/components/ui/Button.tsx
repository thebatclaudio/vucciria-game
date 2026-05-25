import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

/**
 * Button primitives — single source of truth for every interactive surface.
 *
 * Why four components instead of one with a `variant` prop?
 *   - Variant unions get clobbered by Tailwind's tree-shaking unless you
 *     write the class strings in full; that defeats the purpose of a
 *     `variant` prop. Concrete components are easier to read at call sites
 *     and let us share `forwardRef` machinery without bikeshedding.
 *   - Naming a component `PrimaryButton` makes intent visible in JSX — the
 *     reader doesn't have to mentally lookup what `<Button variant="primary">`
 *     resolves to.
 *
 * Sizing notes:
 *   - All variants render at ≥ h-11 (44px) so they clear the iOS tap target.
 *   - Primary uses h-14 because it's the page CTA on every route; secondary
 *     and destructive are h-12 to read as subordinate without shrinking
 *     touch area.
 */

type CommonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Render content full-width (default true — most CTAs are stretched). */
  block?: boolean
  /** Optional leading icon / emoji. Rendered with aria-hidden. */
  leadingIcon?: ReactNode
  /** Optional trailing icon. Rendered with aria-hidden. */
  trailingIcon?: ReactNode
}

/* --------------------------------------------------------------------- */
/* Shared bits                                                            */
/* --------------------------------------------------------------------- */

const BASE =
  'inline-flex items-center justify-center gap-2 font-bold rounded-btn ' +
  'transition active:scale-[0.98] disabled:cursor-not-allowed ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-canvas'

function renderContent(
  leadingIcon: ReactNode,
  children: ReactNode,
  trailingIcon: ReactNode,
) {
  return (
    <>
      {leadingIcon != null && <span aria-hidden>{leadingIcon}</span>}
      <span>{children}</span>
      {trailingIcon != null && <span aria-hidden>{trailingIcon}</span>}
    </>
  )
}

/* --------------------------------------------------------------------- */
/* Primary — filled coffee. One per screen (the page CTA).               */
/* --------------------------------------------------------------------- */

export const PrimaryButton = forwardRef<HTMLButtonElement, CommonProps>(
  function PrimaryButton(
    { block = true, leadingIcon, trailingIcon, children, className = '', ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`${BASE} h-14 px-6 bg-accent text-white shadow-elev-1
          hover:bg-accent-hover focus-visible:ring-accent
          disabled:bg-accent disabled:opacity-30
          ${block ? 'w-full' : ''} ${className}`}
        {...rest}
      >
        {renderContent(leadingIcon, children, trailingIcon)}
      </button>
    )
  },
)

/* --------------------------------------------------------------------- */
/* Secondary — outlined ink. For non-primary CTAs.                       */
/* --------------------------------------------------------------------- */

export const SecondaryButton = forwardRef<HTMLButtonElement, CommonProps>(
  function SecondaryButton(
    { block = false, leadingIcon, trailingIcon, children, className = '', ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`${BASE} h-12 px-5 border-2 border-ink text-ink bg-transparent
          hover:bg-ink hover:text-white focus-visible:ring-ink
          disabled:opacity-30
          ${block ? 'w-full' : ''} ${className}`}
        {...rest}
      >
        {renderContent(leadingIcon, children, trailingIcon)}
      </button>
    )
  },
)

/* --------------------------------------------------------------------- */
/* Destructive — outlined danger. Leave, kick, etc.                      */
/* --------------------------------------------------------------------- */

export const DestructiveButton = forwardRef<HTMLButtonElement, CommonProps>(
  function DestructiveButton(
    { block = false, leadingIcon, trailingIcon, children, className = '', ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`${BASE} h-12 px-5 border-2 border-danger text-danger bg-transparent
          hover:bg-danger hover:text-white focus-visible:ring-danger
          disabled:opacity-30
          ${block ? 'w-full' : ''} ${className}`}
        {...rest}
      >
        {renderContent(leadingIcon, children, trailingIcon)}
      </button>
    )
  },
)

/* --------------------------------------------------------------------- */
/* Link — text-only affordance for tertiary actions (Back, Change profile)*/
/* --------------------------------------------------------------------- */

export const LinkButton = forwardRef<HTMLButtonElement, CommonProps>(
  function LinkButton(
    { leadingIcon, trailingIcon, children, className = '', ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-1
          text-sm text-ink-soft underline underline-offset-4
          hover:text-ink focus:outline-none focus-visible:ring-2
          focus-visible:ring-ink rounded
          disabled:opacity-50 ${className}`}
        {...rest}
      >
        {renderContent(leadingIcon, children, trailingIcon)}
      </button>
    )
  },
)
