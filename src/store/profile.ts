import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Profile {
  nickname: string
  emoji: string
}

interface ProfileState {
  profile: Profile | null
  setProfile: (p: Profile) => void
  clearProfile: () => void
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: null,
      setProfile: (profile) => set({ profile }),
      clearProfile: () => set({ profile: null }),
    }),
    { name: 'vucciria:profile' },
  ),
)
