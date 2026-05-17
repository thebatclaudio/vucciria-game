import { IndexeddbPersistence } from 'y-indexeddb'
import type * as Y from 'yjs'

/**
 * Persist a Y.Doc to IndexedDB so refreshing the page doesn't drop
 * mid-game state.
 *
 * Returns a cleanup function that destroys the persistence binding (but
 * does NOT delete the stored data — call `clearGame(code)` for that).
 */
export function persistGame(code: string, doc: Y.Doc): () => void {
  const provider = new IndexeddbPersistence(`vucciria:${code}`, doc)
  return () => {
    provider.destroy()
  }
}

export async function clearGame(code: string): Promise<void> {
  // Open a transient connection just to clear it.
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(`vucciria:${code}`)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}
