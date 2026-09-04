import { createPinia, defineStore, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { syncSharedStateMock, markItemsAsBoughtMock } = vi.hoisted(() => ({
  syncSharedStateMock: vi.fn(),
  markItemsAsBoughtMock: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(),
  getDoc: vi.fn(),
}))

const itemStore = { items: [] }
const pantryStore = { pantryItems: [], markItemsAsBought: markItemsAsBoughtMock }
const categoryStore = { categories: [] }
const settingsStore = { currency: 'USD' }
const uiStore = {
  loading: false,
  saving: false,
  title: '',
  notification: {},
  navDrawerOpen: true,
  setSaving: vi.fn(),
  addNotification: vi.fn(),
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
vi.stubGlobal('usePantryStore', () => pantryStore)
vi.stubGlobal('useCategoryStore', () => categoryStore)
vi.stubGlobal('useSettingsStore', () => settingsStore)
vi.stubGlobal('useUIStore', () => uiStore)

const { useListStore } = await import('../list')

describe('List store Firestore persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    syncSharedStateMock.mockReset()
    markItemsAsBoughtMock.mockReset()
    localStorage.clear()
  })

  it('does not persist the nav drawer preference', async () => {
    const store = useListStore()
    store.stateLoaded = true

    await store.saveState()

    const payload = syncSharedStateMock.mock.calls[0]![0]
    expect(payload).not.toHaveProperty('navDrawerOpen')
  })

  it('finishes cart items in Pantry before removing them from the list', async () => {
    const store = useListStore()
    store.lists = [
      {
        id: 'list-1',
        name: 'Shopping List',
        icon: 'list',
        cartPanelOpen: true,
        items: [
          { itemId: 'milk', notes: '', addedToCart: true, quantity: 1 },
          { itemId: 'bananas', notes: '', addedToCart: true, quantity: 1 },
          { itemId: 'eggs', notes: '', addedToCart: false, quantity: 1 },
        ],
      },
    ]

    await store.finishAndClearCart('list-1')

    expect(markItemsAsBoughtMock).toHaveBeenCalledWith(['milk', 'bananas'])
    expect(store.listById('list-1')?.items).toEqual([
      { itemId: 'eggs', notes: '', addedToCart: false, quantity: 1 },
    ])
    expect(syncSharedStateMock).toHaveBeenLastCalledWith({
      lists: store.lists,
      pantryItems: pantryStore.pantryItems,
    })
  })
})
