import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/user'
interface AuthState {
  user: User | null; isLoggedIn: boolean
  login: (user: User) => void; logout: () => void
}
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: { id:'1', username:'edenflow', name:'정지한', email:'EDEN@teamedenmarketing.com', plan:'FREE', createdAt:'2024-01-01' },
      isLoggedIn: true,
      login: (user) => set({ user, isLoggedIn: true }),
      logout: () => set({ user: null, isLoggedIn: false }),
    }),
    { name: 'auth-storage' }
  )
)
