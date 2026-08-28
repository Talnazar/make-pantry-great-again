import { createPinia, defineStore, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { syncSharedStateMock } = vi.hoisted(() => ({
  syncSharedStateMock: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(),
  getDoc: vi.fn(),
}))

const itemStore = { items: [] }
const categoryStore = { categories: [] }
const settingsStore = { currency: 'USD', showIntro: false }
const uiStore = {
  loading: false,
  saving: false,
  title: '',
  notification: {},
  navDrawerOpen: true,
}

vi.stubGlobal('defineStore', defineStore)
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('syncSharedState', syncSharedStateMock)
vi.stubGlobal(
  'sharedStateDoc',
  vi.fn(() => 'state-doc'),
)
vi.stubGlobal('useItemStore', () => itemStore)
vi.stubGlobal('useCategoryStore', () => categoryStore)
vi.stubGlobal('useSettingsStore', () => settingsStore)
vi.stubGlobal('useUIStore', () => uiStore)

const { useListStore } = await import('../list')

describe('List store Firestore persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    syncSharedStateMock.mockReset()
    localStorage.clear()
  })

  it('does not persist the nav drawer preference', async () => {
    const store = useListStore()
    store.stateLoaded = true

    await store.saveState()

    const payload = syncSharedStateMock.mock.calls[0]![0]
    expect(payload).not.toHaveProperty('navDrawerOpen')
  })
})
