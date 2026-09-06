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

const listStore = { lists: [], selectedListId: 'list-1', sanitizeState: vi.fn() }
const itemStore = { items: [] }
const pantryStore = { pantryItems: [] }
const categoryStore = { categories: [] }
const settingsStore = { currency: 'USD', timeFormat: '24-hour', defaultStaleAfterDays: 7 }
const uiStore = {
  loading: false,
  saving: false,
  title: '',
  notification: {},
  navDrawerOpen: true,
  setSaving: vi.fn(),
}

vi.stubGlobal('defineStore', defineStore)
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('syncSharedState', syncSharedStateMock)
vi.stubGlobal(
  'sharedStateDoc',
  vi.fn(() => 'state-doc'),
)
vi.stubGlobal('useListStore', () => listStore)
vi.stubGlobal('useItemStore', () => itemStore)
vi.stubGlobal('usePantryStore', () => pantryStore)
vi.stubGlobal('useCategoryStore', () => categoryStore)
vi.stubGlobal('useSettingsStore', () => settingsStore)
vi.stubGlobal('useUIStore', () => uiStore)

const { useAppStateStore } = await import('../appState')

describe('App state store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    syncSharedStateMock.mockReset()
    localStorage.clear()
  })

  it('does not persist the nav drawer preference', async () => {
    const store = useAppStateStore()
    store.stateLoaded = true

    await store.saveState()

    const payload = syncSharedStateMock.mock.calls[0]![0]
    expect(payload).not.toHaveProperty('navDrawerOpen')
  })

  it('does not sync to Firestore before the state is loaded', async () => {
    const store = useAppStateStore()
    store.stateLoaded = false

    await store.saveState()

    expect(syncSharedStateMock).not.toHaveBeenCalled()
  })
})
