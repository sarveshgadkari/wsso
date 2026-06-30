import { create } from 'zustand'

interface AppState {
  /** Mobile: whether the sidebar drawer is open */
  isSidebarOpen: boolean
  toggleSidebar: () => void
  closeSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  closeSidebar:  () => set({ isSidebarOpen: false }),
}))
