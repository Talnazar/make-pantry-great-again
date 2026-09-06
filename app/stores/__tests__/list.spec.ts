import { createPinia, defineStore, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { syncSharedStateMock, completePurchasedItemsMock, persistToLocalStorageMock } = vi.hoisted(
  () => ({
    syncSharedStateMock: vi.fn(),
    completePurchasedItemsMock: vi.fn(),
    persistToLocalStorageMock: vi.fn(),
  }),
)

const itemStore = { items: [] }
const pantryStore = { pantryItems: [], completePurchasedItems: completePurchasedItemsMock }
const categoryStore = { categories: [] }
const settingsStore = { currency: 'USD' }
const appStateStore = { persistToLocalStorage: persistToLocalStorageMock }
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
vi.stubGlobal('useItemStore', () => itemStore)
vi.stubGlobal('usePantryStore', () => pantryStore)
vi.stubGlobal('useCategoryStore', () => categoryStore)
vi.stubGlobal('useSettingsStore', () => settingsStore)
vi.stubGlobal('useUIStore', () => uiStore)
vi.stubGlobal('useAppStateStore', () => appStateStore)

const { useListStore } = await import('../list')

describe('List store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    syncSharedStateMock.mockReset()
    completePurchasedItemsMock.mockReset()
    persistToLocalStorageMock.mockReset()
    localStorage.clear()
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

    expect(completePurchasedItemsMock).toHaveBeenCalledWith(['milk', 'bananas'], [])
    expect(store.listById('list-1')?.items).toEqual([
      { itemId: 'eggs', notes: '', addedToCart: false, quantity: 1 },
    ])
    expect(syncSharedStateMock).toHaveBeenLastCalledWith({
      lists: store.lists,
      pantryItems: pantryStore.pantryItems,
    })
  })
})
