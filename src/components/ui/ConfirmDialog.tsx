import { useTranslation } from 'react-i18next'
import ModalShell from './ModalShell'
import {
  PrimaryButton,
  SecondaryButton,
  DestructiveButton,
} from './Button'

/**
 * Lightweight "are you sure?" dialog.
 *
 * Replaces the (previously absent) confirmation step for destructive
 * actions across the app: clearing the profile, leaving a lobby, kicking
 * another player, zeroing someone's lives, going back to the dashboard
 * after a game.
 *
 * Two tone variants:
 *   - `danger` (default for destructive ops)  → confirm = DestructiveButton
 *   - `primary` (for non-destructive confirmations) → confirm = PrimaryButton
 *
 * The cancel button is always a `SecondaryButton` so the visual hierarchy
 * is: dangerous primary action on the right (matches iOS sheet convention
 * for English LTR), neutral cancel on the left.
 *
 * Esc / backdrop dismiss both fire `onCancel` so the user never feels
 * trapped. There's no separate "x" button — backdrop + Esc + Cancel are
 * three redundant ways to bail.
 */
type Props = {
  open: boolean
  title: string
  body?: string
  /** Defaults to i18n `common.confirm`. */
  confirmLabel?: string
  /** Defaults to i18n `common.cancel`. */
  cancelLabel?: string
  /** Confirm button color. Defaults to `danger`. */
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation()
  const Confirm = tone === 'danger' ? DestructiveButton : PrimaryButton

  return (
    <ModalShell
      open={open}
      onDismiss={onCancel}
      labelledBy="confirm-dialog-title"
      describedBy={body ? 'confirm-dialog-body' : undefined}
    >
      <h2
        id="confirm-dialog-title"
        className="text-xl sm:text-2xl font-bold text-ink text-center"
      >
        {title}
      </h2>
      {body && (
        <p
          id="confirm-dialog-body"
          className="text-sm text-ink-soft text-center leading-relaxed"
        >
          {body}
        </p>
      )}
      {/* Action row: stack on mobile (vertically thumb-reachable), inline
          on wider viewports. Confirm comes after Cancel in DOM order so
          Tab moves Cancel → Confirm — but visually we place Confirm on
          the right (LTR convention) via `sm:flex-row-reverse`. */}
      <div className="flex flex-col-reverse sm:flex-row-reverse gap-2 mt-2">
        <Confirm onClick={onConfirm} block className="sm:flex-1">
          {confirmLabel ?? t('common.confirm')}
        </Confirm>
        <SecondaryButton onClick={onCancel} block className="sm:flex-1">
          {cancelLabel ?? t('common.cancel')}
        </SecondaryButton>
      </div>
    </ModalShell>
  )
}
