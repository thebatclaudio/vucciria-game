import { create } from 'zustand'

interface UIState {
  /** Optional toast message shown briefly. */
  toast: string | null
  showToast: (msg: string) => void
  clearToast: () => void
}

export const useUIStore = create<UIState>((set) => ({
  toast: null,
  showToast: (toast) => {
    set({ toast })
    setTimeout(() => set({ toast: null }), 2500)
  },
  clearToast: () => set({ toast: null }),
}))
