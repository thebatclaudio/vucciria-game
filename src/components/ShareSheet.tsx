import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ModalShell from '@/components/ui/ModalShell'
import {
  SecondaryButton,
  PrimaryButton,
} from '@/components/ui/Button'
import { useToast } from '@/components/ui/useToast'

/**
 * Lobby share sheet: surfaces every way a player can pass the game code
 * to the rest of the table.
 *
 *   ┌──────────────────────────┐
 *   │       Share lobby        │
 *   │                          │
 *   │          ABC123          │   ← big code (selectable)
 *   │                          │
 *   │     ┌────────────┐       │
 *   │     │  QR code   │       │   ← scan with another phone
 *   │     └────────────┘       │
 *   │                          │
 *   │  [ 📋 Copy ]  [ 📤 Share ]
 *   └──────────────────────────┘
 *
 * Behaviours:
 *   - QR is generated on-the-fly with `qrcode` for the canonical join
 *     URL (`{origin}{base}#/lobby/{code}`). On mobile this works as a
 *     direct scan-to-join from another phone — even before the recipient
 *     has the app on their home screen.
 *   - Copy puts the code on the clipboard and fires a toast.
 *   - Share button only appears when `navigator.share` is available
 *     (mobile Safari, Android Chrome, etc.) and uses the native share
 *     sheet so users land on their iMessage / WhatsApp / Telegram
 *     directly.
 */

type Props = {
  open: boolean
  code: string
  /** Optional game name; included in the native share payload as title. */
  gameName?: string
  onClose: () => void
}

/**
 * Build the deep-link the QR code encodes. Uses the configured Vite
 * `base` so the URL matches whatever deployment we're on (production
 * `/vucciria-game-v2.0/`, local dev `/`, etc.).
 */
function buildShareUrl(code: string): string {
  if (typeof window === 'undefined') return ''
  const origin = window.location.origin
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${origin}${base}/#/lobby/${code}`
}

export default function ShareSheet({ open, code, gameName, onClose }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  // Generate (and re-generate when the code changes) the QR image. We
  // render it as a data URL on an <img> so the canvas stays out of the
  // React tree; that means screen-readers can also pick up the alt text.
  //
  // `qrcode` is dynamically imported so the ~30 KB minified library
  // (`qrcode-vendor` chunk) only lands on the wire when the user
  // actually opens the share sheet. Lobby first paint stays lean.
  useEffect(() => {
    if (!open) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    const url = buildShareUrl(code)
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(url, {
          // High-contrast on the white dialog background.
          color: { dark: '#3E2723', light: '#FFFFFF' },
          margin: 1,
          width: 256,
          // Default M is enough; we don't expect heavy graphic overlay on it.
          errorCorrectionLevel: 'M',
        }),
      )
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        // QR generation failure (or chunk load failure) is recoverable —
        // the code itself is still visible above. Don't block the dialog.
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, code])

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast.show({ message: t('toast.codeCopied'), tone: 'success' })
    } catch {
      toast.show({ message: t('toast.codeCopyFailed'), tone: 'warn' })
    }
  }

  const nativeShare = async () => {
    const url = buildShareUrl(code)
    try {
      await navigator.share({
        title: gameName || t('app.title'),
        text: t('share.payload', { code }),
        url,
      })
    } catch {
      // User-cancelled share rejects the promise on most platforms.
      // Silently ignore — nothing to surface.
    }
  }

  return (
    <ModalShell
      open={open}
      onDismiss={onClose}
      labelledBy="share-sheet-title"
    >
      <h2
        id="share-sheet-title"
        className="text-xl sm:text-2xl font-bold text-ink text-center"
      >
        {t('share.title')}
      </h2>
      <p className="text-sm text-ink-soft text-center -mt-1">
        {t('share.subtitle')}
      </p>

      {/* Big monospaced code, selectable so users can long-press to copy
          on platforms where the JS clipboard API is restricted. */}
      <p
        className="text-5xl font-mono font-bold tracking-widest text-ink text-center my-2 select-all"
        aria-label={t('lobby.code')}
      >
        {code}
      </p>

      {/* QR. Reserved height prevents layout jump while the image
          generates asynchronously. */}
      <div className="flex justify-center items-center h-[260px]">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={t('share.qrAlt')}
            width={256}
            height={256}
            className="rounded-tile ring-1 ring-ink/10"
          />
        ) : (
          <div className="w-[256px] h-[256px] rounded-tile bg-canvas/40 ring-1 ring-ink/10 animate-pulse" />
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
        <SecondaryButton onClick={copyCode} block className="sm:flex-1">
          📋 {t('lobby.copy')}
        </SecondaryButton>
        {canNativeShare && (
          <PrimaryButton onClick={nativeShare} block className="sm:flex-1">
            📤 {t('share.systemShare')}
          </PrimaryButton>
        )}
      </div>
    </ModalShell>
  )
}
