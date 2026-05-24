/**
 * Curated catalog of player avatar emoji.
 *
 * Two exports:
 *  - `DEFAULT_EMOJIS` — faces, animals, and creatures only. Used as the
 *    pool for the random avatar suggested on the Home screen so first-time
 *    players land on a person-shaped (or critter-shaped) identity rather
 *    than a slice of pizza or a guitar.
 *  - `EMOJIS` — full catalog (DEFAULT_EMOJIS + everything else). Used by
 *    the manual EmojiPicker so users can still pick a food, drink, sport,
 *    instrument, or celestial body if they want to.
 *
 * Add freely; the picker handles scrolling and shuffling. Keep
 * DEFAULT_EMOJIS limited to faces / animals / creatures (mythical beasts
 * included) — anything else belongs in OTHER_EMOJIS below.
 */

// Faces & creatures (people-shaped or sentient-looking).
const FACES_AND_CREATURES: readonly string[] = [
  '😀', '😎', '🥳', '🤩', '😇', '🥰', '😋', '🤓', '🧐', '🤠',
  '🥸', '😈', '👻', '💀', '🤖', '👽', '👾', '🤡', '👹', '👺',
  '🙈', '🙉', '🙊', '🦄',
]

// Animals (real-world critters, birds, sea life, bugs).
const ANIMALS: readonly string[] = [
  '🦊', '🐱', '🐶', '🐺', '🦁', '🐯', '🐮', '🐷', '🐸', '🐵',
  '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉',
  '🐗', '🐴', '🐝', '🪲', '🐛', '🦋', '🐌', '🐞', '🦝',
  '🐢', '🐍', '🦎', '🐙', '🦑', '🦐', '🦀', '🐡', '🐠', '🐟',
  '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧',
  '🐘', '🦛', '🦏', '🐪', '🐫', '🦙', '🦒', '🐃', '🐂', '🐄',
  '🐎', '🐖', '🐏', '🐑', '🐐', '🦌', '🐕', '🐩', '🐈', '🐇',
  '🐀', '🐁', '🦔', '🦇', '🐻', '🐨', '🐼', '🦥', '🦦', '🦨',
  '🐿',
]

/**
 * Pool used for the random suggestion on Home. Faces + creatures + animals
 * only — no food, drinks, instruments, etc.
 */
export const DEFAULT_EMOJIS: readonly string[] = [
  ...FACES_AND_CREATURES,
  ...ANIMALS,
]

// Everything else, available in the manual picker but excluded from the
// random default.
const OTHER_EMOJIS: readonly string[] = [
  // Food
  '🍕', '🍔', '🌭', '🍟', '🍿', '🌮', '🌯', '🥙', '🥗', '🍝',
  '🍜', '🍣', '🍱', '🥟', '🍙', '🍘', '🍡', '🍢', '🍤', '🍩',
  '🍪', '🎂', '🍰', '🧁', '🍦', '🍨', '🍧', '🍫', '🍬', '🍭',
  '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒',
  '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬',
  // Drinks
  '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🍾', '🧉', '🍶',
  // Symbols, hands, sports
  '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🪀', '🏓',
  '🎮', '🕹️', '🎲', '🃏', '🎯', '🎳', '🎤', '🎧', '🎷', '🎸',
  '🎺', '🎻', '🥁', '🎹', '🪘', '🎬', '🎨', '🖌️', '🪄', '🎭',
  // Nature & sky
  '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑',
  '⭐', '🌟', '✨', '⚡', '🔥', '🌈', '☀️', '🌤️', '⛅', '🌧️',
]

/**
 * Full catalog used by the manual EmojiPicker. Users can still choose
 * anything in here — the DEFAULT_EMOJIS restriction only applies to the
 * random suggestion on Home.
 */
export const EMOJIS: readonly string[] = [...DEFAULT_EMOJIS, ...OTHER_EMOJIS]
