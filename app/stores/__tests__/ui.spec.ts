import { createPinia, defineStore, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { syncSharedStateMock, persistToLocalStorageMock } = vi.hoisted(() => ({
  syncSharedStateMock: vi.fn(),
  persistToLocalStorageMock: vi.fn(),
}))

const appStateStore = {
  stateLoaded: true,
  persistToLocalStorage: persistToLocalStorageMock,
}

vi.stubGlobal('defineStore', defineStore)
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('syncSharedState', syncSharedStateMock)
vi.stubGlobal('useAppStateStore', () => appStateStore)

const { useUIStore } = await import('../ui')

describe('UI store nav drawer persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    syncSharedStateMock.mockReset()
    persistToLocalStorageMock.mockReset()
    appStateStore.stateLoaded = true
  })

  it('keeps mobile drawer changes local', async () => {
    const store = useUIStore()

    await store.setNavDrawer(true, false)

    expect(store.navDrawerOpen).toBe(true)
    expect(persistToLocalStorageMock).toHaveBeenCalledOnce()
    expect(syncSharedStateMock).not.toHaveBeenCalled()
  })

  it('persists desktop drawer changes to the shared state', async () => {
    const store = useUIStore()

    await store.setNavDrawer(true)

    expect(syncSharedStateMock).toHaveBeenCalledWith({ navDrawerOpen: true })
  })

  it('does not persist before app state is loaded', async () => {
    appStateStore.stateLoaded = false
    const store = useUIStore()

    await store.setNavDrawer(true)

    expect(store.navDrawerOpen).toBe(true)
    expect(persistToLocalStorageMock).toHaveBeenCalledOnce()
    expect(syncSharedStateMock).not.toHaveBeenCalled()
  })
})
