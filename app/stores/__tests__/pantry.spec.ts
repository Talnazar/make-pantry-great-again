import { createPinia, defineStore, setActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { syncSharedStateMock, persistToLocalStorageMock, addNotificationMock } = vi.hoisted(() => ({
  syncSharedStateMock: vi.fn(),
  persistToLocalStorageMock: vi.fn(),
  addNotificationMock: vi.fn(),
}))

interface MockItem {
  id: string
  name: string
  unit: string | null
  categoryId: string
}

const CATALOG_ITEMS: MockItem[] = [
  { id: 'eggs', name: 'Eggs', unit: null, categoryId: 'food' },
  { id: 'rice', name: 'Rice', unit: null, categoryId: 'food' },
  { id: 'milk', name: 'Milk', unit: null, categoryId: 'food' },
  { id: 'bananas', name: 'Bananas', unit: null, categoryId: 'food' },
]

const itemStore = {
  items: [...CATALOG_ITEMS] as MockItem[],
  findItemById(itemId: string) {
    return this.items.find((item) => item.id === itemId)
  },
  nameToId(name: string) {
    return name.trim().toLowerCase()
  },
  ensureItem(name: string) {
    const itemId = this.nameToId(name)
    if (!this.findItemById(itemId)) {
      this.items = [
        ...this.items,
        { id: itemId, name: name.trim(), unit: null, categoryId: 'uncategorized' },
      ]
    }
    return itemId
  },
}

const listStore = {
  lists: [] as Array<{
    id: string
    name: string
    icon: string
    cartPanelOpen: boolean
    items: Array<{
      itemId: string
      notes: string
      addedToCart: boolean
      quantity: number
    }>
  }>,
  async createListWithItems(
    request: { id: string; name: string; icon: string },
    itemIds: string[],
  ) {
    this.lists.push({
      ...request,
      cartPanelOpen: true,
      items: itemIds.map((itemId) => ({
        itemId,
        notes: '',
        addedToCart: false,
        quantity: 1,
      })),
    })
    return request.id
  },
  listById(listId: string) {
    return this.lists.find((list) => list.id === listId)
  },
}

const appStateStore = {
  persistToLocalStorage: persistToLocalStorageMock,
}

const uiStore = {
  saving: false,
  setSaving(value: boolean) {
    this.saving = value
  },
  addNotification: addNotificationMock,
}

vi.stubGlobal('defineStore', defineStore)
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('syncSharedState', syncSharedStateMock)
vi.stubGlobal('useItemStore', () => itemStore)
vi.stubGlobal('useListStore', () => listStore)
vi.stubGlobal('useAppStateStore', () => appStateStore)
vi.stubGlobal('useUIStore', () => uiStore)
vi.stubGlobal('crypto', { randomUUID: () => 'pantry-list-id' })

const { usePantryStore } = await import('../pantry')

describe('Pantry store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    listStore.lists = []
    itemStore.items = [...CATALOG_ITEMS]
    uiStore.saving = false
    syncSharedStateMock.mockReset()
    persistToLocalStorageMock.mockReset()
    addNotificationMock.mockReset()
  })

  it('adds valid catalog items and prevents duplicates', async () => {
    const store = usePantryStore()

    await store.addItem('eggs')
    await store.addItem('eggs')
    await store.addItem('missing')

    expect(store.pantryItems).toHaveLength(1)
    expect(store.pantryItemById('eggs')).toMatchObject({
      itemId: 'eggs',
      haveAtHome: false,
      needToBuy: false,
    })
    expect(store.pantryItemById('eggs')?.updatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    )
    expect(store.pantryItemById('eggs')?.staleAfterDays).toBeNull()
    expect(syncSharedStateMock).toHaveBeenCalledOnce()
  })

  it('adds an unknown name to both the catalog and the pantry', async () => {
    const store = usePantryStore()

    await store.addItemByName('  Sourdough Bread ')

    expect(itemStore.findItemById('sourdough bread')).toEqual({
      id: 'sourdough bread',
      name: 'Sourdough Bread',
      unit: null,
      categoryId: 'uncategorized',
    })
    expect(store.pantryItemById('sourdough bread')).toMatchObject({
      itemId: 'sourdough bread',
      haveAtHome: false,
      needToBuy: false,
      staleAfterDays: null,
    })
    expect(syncSharedStateMock).toHaveBeenCalledWith({
      items: itemStore.items,
      pantryItems: store.pantryItems,
    })
    expect(persistToLocalStorageMock).toHaveBeenCalledOnce()
  })

  it('reuses the existing catalog item when the name is already known', async () => {
    const store = usePantryStore()

    await store.addItemByName('eggs')

    expect(itemStore.items).toHaveLength(CATALOG_ITEMS.length)
    expect(store.pantryItemById('eggs')).toBeDefined()
  })

  it('ignores blank names and names already in the pantry', async () => {
    const store = usePantryStore()
    await store.addItemByName('Eggs')
    syncSharedStateMock.mockReset()

    await store.addItemByName('   ')
    await store.addItemByName('eggs')

    expect(store.pantryItems).toHaveLength(1)
    expect(syncSharedStateMock).not.toHaveBeenCalled()
  })

  it('rejects names longer than the item name limit', async () => {
    const store = usePantryStore()

    await store.addItemByName('a'.repeat(51))

    expect(store.pantryItems).toHaveLength(0)
    expect(itemStore.items).toHaveLength(CATALOG_ITEMS.length)
    expect(addNotificationMock).toHaveBeenCalledWith({
      type: 'error',
      message: 'You name must be maximum 50 characters',
    })
    expect(syncSharedStateMock).not.toHaveBeenCalled()
  })

  it('keeps have-at-home and need-to-buy flags independent', async () => {
    const store = usePantryStore()
    await store.addItem('eggs')

    await store.setHaveAtHome('eggs', true)
    expect(store.pantryItemById('eggs')).toMatchObject({
      haveAtHome: true,
      needToBuy: false,
    })

    await store.setNeedToBuy('eggs', true)
    expect(store.pantryItemById('eggs')).toMatchObject({
      haveAtHome: true,
      needToBuy: true,
    })

    await store.setHaveAtHome('eggs', false)
    expect(store.pantryItemById('eggs')).toMatchObject({
      haveAtHome: false,
      needToBuy: true,
    })
  })

  it('updates updatedAt only when flags actually change', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T19:48:30.123Z'))
    const store = usePantryStore()
    await store.addItem('eggs')
    const initialTimestamp = store.pantryItemById('eggs')!.updatedAt

    await store.setHaveAtHome('eggs', false)
    expect(store.pantryItemById('eggs')!.updatedAt).toBe(initialTimestamp)

    vi.setSystemTime(new Date('2026-09-04T19:48:31.123Z'))
    await store.setHaveAtHome('eggs', true)
    expect(store.pantryItemById('eggs')!.updatedAt).not.toBe(initialTimestamp)
    const changedTimestamp = store.pantryItemById('eggs')!.updatedAt

    await store.setHaveAtHome('eggs', true)
    expect(store.pantryItemById('eggs')!.updatedAt).toBe(changedTimestamp)
    vi.useRealTimers()
  })

  it('updates the stale threshold without changing the checked timestamp', async () => {
    const store = usePantryStore()
    await store.addItem('eggs')
    const initialTimestamp = store.pantryItemById('eggs')!.updatedAt

    await store.setStaleAfterDays('eggs', 14)

    expect(store.pantryItemById('eggs')).toMatchObject({
      staleAfterDays: 14,
      updatedAt: initialTimestamp,
    })
    expect(syncSharedStateMock).toHaveBeenCalledTimes(2)
  })

  it('resets the stale threshold to the default without changing the checked timestamp', async () => {
    const store = usePantryStore()
    await store.addItem('eggs')
    await store.setStaleAfterDays('eggs', 14)
    const initialTimestamp = store.pantryItemById('eggs')!.updatedAt

    await store.resetStaleAfterDays('eggs')

    expect(store.pantryItemById('eggs')).toMatchObject({
      staleAfterDays: null,
      updatedAt: initialTimestamp,
    })
    expect(syncSharedStateMock).toHaveBeenCalledTimes(3)

    await store.resetStaleAfterDays('eggs')
    expect(syncSharedStateMock).toHaveBeenCalledTimes(3)
  })

  it('ignores invalid stale thresholds', async () => {
    const store = usePantryStore()
    await store.addItem('eggs')

    await store.setStaleAfterDays('eggs', 0)
    await store.setStaleAfterDays('eggs', 1.5)

    expect(store.pantryItemById('eggs')?.staleAfterDays).toBeNull()
    expect(syncSharedStateMock).toHaveBeenCalledOnce()
  })

  it('adds selected missing purchases as already bought', () => {
    const store = usePantryStore()
    store.completePurchasedItems(['milk', 'bananas'], ['bananas'])

    expect(store.pantryItems).toHaveLength(1)
    expect(store.pantryItemById('bananas')).toMatchObject({
      itemId: 'bananas',
      haveAtHome: true,
      needToBuy: false,
    })
    expect(store.pantryItemById('bananas')?.updatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    )
    expect(store.pantryItemById('bananas')?.staleAfterDays).toBeNull()
  })

  it('keeps the timestamp unchanged when purchased flags are already complete', () => {
    const store = usePantryStore()
    store.pantryItems = [
      {
        itemId: 'milk',
        haveAtHome: true,
        needToBuy: false,
        updatedAt: '2026-09-01T00:00:00.000Z',
        staleAfterDays: 7,
      },
    ]

    store.completePurchasedItems(['milk'], [])

    expect(store.pantryItemById('milk')?.updatedAt).toBe('2026-09-01T00:00:00.000Z')
  })

  it('adds a timestamp when hydrating legacy Pantry items', () => {
    const store = usePantryStore()

    store.hydrateItems([{ itemId: 'eggs', haveAtHome: false, needToBuy: true }])

    expect(store.pantryItemById('eggs')?.updatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    )
    expect(store.pantryItemById('eggs')?.staleAfterDays).toBeNull()
  })

  it('preserves an explicit seven-day threshold', () => {
    const store = usePantryStore()

    store.hydrateItems([{ itemId: 'eggs', staleAfterDays: 7 }])

    expect(store.pantryItemById('eggs')?.staleAfterDays).toBe(7)
  })

  it('exports only selected items marked as need to buy without changing Pantry state', async () => {
    const store = usePantryStore()
    await store.addItem('eggs')
    await store.addItem('rice')
    await store.setNeedToBuy('eggs', true)
    await store.setNeedToBuy('rice', true)
    const pantryBeforeExport = store.pantryItems.map((pantryItem) => ({ ...pantryItem }))

    const listId = await store.createShoppingList(['eggs'])

    expect(listId).toBe('pantry-list-id')
    expect(listStore.listById('pantry-list-id')?.name).toMatch(
      /^Pantry Shopping List - \d{4}-\d{2}-\d{2}$/,
    )
    expect(listStore.listById('pantry-list-id')?.items).toEqual([
      { itemId: 'eggs', notes: '', addedToCart: false, quantity: 1 },
    ])
    expect(store.pantryItems).toEqual(pantryBeforeExport)
  })

  it('updates and removes catalog references', () => {
    const store = usePantryStore()
    store.pantryItems = [
      {
        itemId: 'eggs',
        haveAtHome: true,
        needToBuy: false,
        updatedAt: '2026-09-01T00:00:00.000Z',
        staleAfterDays: 7,
      },
      {
        itemId: 'rice',
        haveAtHome: false,
        needToBuy: true,
        updatedAt: '2026-09-01T00:00:00.000Z',
        staleAfterDays: 7,
      },
    ]

    expect(store.updateItemId('eggs', 'milk')).toBe(true)
    expect(store.updateItemId('rice', 'milk')).toBe(false)
    expect(store.updateItemId('missing', 'new-item')).toBe(false)
    expect(store.pantryItemById('milk')).toEqual({
      itemId: 'milk',
      haveAtHome: true,
      needToBuy: false,
      updatedAt: '2026-09-01T00:00:00.000Z',
      staleAfterDays: 7,
    })

    store.removeItemReference('milk')
    expect(store.pantryItemById('milk')).toBeUndefined()
  })
})
