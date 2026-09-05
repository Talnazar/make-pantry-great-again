import type { Item, PantryItem } from '~/types/state'

export interface MaterializedPantryItem {
  item: Item
  pantryItem: PantryItem
}

export const usePantryStore = defineStore('pantry', () => {
  const pantryItems = ref<PantryItem[]>([])

  const materializedPantryItems = computed((): MaterializedPantryItem[] => {
    const itemStore = useItemStore()

    return pantryItems.value
      .map((pantryItem): MaterializedPantryItem | null => {
        const item = itemStore.findItemById(pantryItem.itemId)
        return item ? { item, pantryItem } : null
      })
      .filter((item): item is MaterializedPantryItem => item !== null)
      .sort((a, b) => a.item.name.localeCompare(b.item.name))
  })

  const itemsToBuy = computed(() =>
    materializedPantryItems.value.filter(({ pantryItem }) => pantryItem.needToBuy),
  )

  function pantryItemById(itemId: string): PantryItem | undefined {
    return pantryItems.value.find((pantryItem) => pantryItem.itemId === itemId)
  }

  function hasPantryItem(itemId: string): boolean {
    return pantryItemById(itemId) !== undefined
  }

  async function addItem(itemId: string) {
    const itemStore = useItemStore()
    const uiStore = useUIStore()

    if (!itemStore.findItemById(itemId) || hasPantryItem(itemId)) return

    uiStore.setSaving(true)
    pantryItems.value = [
      ...pantryItems.value,
      {
        itemId,
        haveAtHome: false,
        needToBuy: false,
        updatedAt: new Date().toISOString(),
        staleAfterDays: null,
      },
    ]

    await persistAndSync()
    uiStore.setSaving(false)
  }

  async function removeItem(itemId: string) {
    if (!hasPantryItem(itemId)) return

    const uiStore = useUIStore()
    uiStore.setSaving(true)
    pantryItems.value = pantryItems.value.filter((pantryItem) => pantryItem.itemId !== itemId)

    await persistAndSync()
    uiStore.setSaving(false)
  }

  async function setHaveAtHome(itemId: string, haveAtHome: boolean) {
    await updateFlags(itemId, { haveAtHome })
  }

  async function setNeedToBuy(itemId: string, needToBuy: boolean) {
    await updateFlags(itemId, { needToBuy })
  }

  async function setStaleAfterDays(itemId: string, staleAfterDays: number) {
    if (!hasPantryItem(itemId) || !Number.isInteger(staleAfterDays) || staleAfterDays < 1) return

    const uiStore = useUIStore()
    uiStore.setSaving(true)
    pantryItems.value = pantryItems.value.map((pantryItem) =>
      pantryItem.itemId === itemId ? { ...pantryItem, staleAfterDays } : pantryItem,
    )

    await persistAndSync()
    uiStore.setSaving(false)
  }

  async function checkItem(itemId: string) {
    if (!hasPantryItem(itemId)) return

    const uiStore = useUIStore()
    uiStore.setSaving(true)
    pantryItems.value = pantryItems.value.map((pantryItem) =>
      pantryItem.itemId === itemId
        ? { ...pantryItem, updatedAt: new Date().toISOString() }
        : pantryItem,
    )

    await persistAndSync()
    uiStore.setSaving(false)
  }

  function hydrateItems(items: Array<Partial<PantryItem>> = []) {
    const fallbackTimestamp = new Date().toISOString()
    pantryItems.value = items.map((pantryItem) => ({
      itemId: pantryItem.itemId!,
      haveAtHome: pantryItem.haveAtHome ?? false,
      needToBuy: pantryItem.needToBuy ?? false,
      updatedAt: pantryItem.updatedAt ?? fallbackTimestamp,
      staleAfterDays:
        pantryItem.staleAfterDays === undefined || pantryItem.staleAfterDays === 7
          ? null
          : pantryItem.staleAfterDays,
    }))
  }

  function completePurchasedItems(itemIds: string[], itemIdsToAdd: string[]) {
    const itemStore = useItemStore()
    const purchasedIds = new Set(itemIds)
    const idsToAdd = new Set(itemIdsToAdd.filter((itemId) => purchasedIds.has(itemId)))
    const existingIds = new Set(pantryItems.value.map((pantryItem) => pantryItem.itemId))

    pantryItems.value = pantryItems.value.map((pantryItem) => {
      if (!purchasedIds.has(pantryItem.itemId)) return pantryItem

      const flagsChanged = !pantryItem.haveAtHome || pantryItem.needToBuy
      return flagsChanged
        ? {
            ...pantryItem,
            haveAtHome: true,
            needToBuy: false,
            updatedAt: new Date().toISOString(),
          }
        : pantryItem
    })

    const newPantryItems = itemStore.items
      .filter((item) => idsToAdd.has(item.id) && !existingIds.has(item.id))
      .map((item) => ({
        itemId: item.id,
        haveAtHome: true,
        needToBuy: false,
        updatedAt: new Date().toISOString(),
        staleAfterDays: null,
      }))

    if (newPantryItems.length > 0) {
      pantryItems.value = [...pantryItems.value, ...newPantryItems]
    }
  }

  async function createShoppingList(itemIds: string[], name?: string) {
    const selectedIds = new Set(itemIds)
    // Todo : I dont think we need to filter it again and we can assume that the input alreay have only need to buy.
    const exportItems = itemsToBuy.value.filter(({ pantryItem }) =>
      selectedIds.has(pantryItem.itemId),
    )

    if (exportItems.length === 0) return undefined

    const listStore = useListStore()
    const listId = crypto.randomUUID()
    const today = new Date()
    const date = [today.getFullYear(), today.getMonth() + 1, today.getDate()]
      .map((part) => part.toString().padStart(2, '0'))
      .join('-')
    const defaultName = `Pantry Shopping List - ${date}`

    return listStore.createListWithItems(
      {
        id: listId,
        name: name?.trim() || defaultName,
        icon: 'list',
      },
      exportItems.map(({ pantryItem }) => pantryItem.itemId),
    )
  }

  function updateItemId(oldItemId: string, newItemId: string): boolean {
    if (oldItemId === newItemId) return true
    if (!hasPantryItem(oldItemId)) return false
    if (hasPantryItem(newItemId)) return false

    pantryItems.value = pantryItems.value.map((pantryItem) =>
      pantryItem.itemId === oldItemId ? { ...pantryItem, itemId: newItemId } : pantryItem,
    )

    return true
  }

  function removeItemReference(itemId: string) {
    pantryItems.value = pantryItems.value.filter((pantryItem) => pantryItem.itemId !== itemId)
  }

  async function updateFlags(
    itemId: string,
    flags: Partial<Pick<PantryItem, 'haveAtHome' | 'needToBuy'>>,
  ) {
    if (!hasPantryItem(itemId)) return

    const uiStore = useUIStore()
    uiStore.setSaving(true)
    pantryItems.value = pantryItems.value.map((pantryItem) => {
      if (pantryItem.itemId !== itemId) return pantryItem

      const haveAtHome = flags.haveAtHome ?? pantryItem.haveAtHome
      const needToBuy = flags.needToBuy ?? pantryItem.needToBuy
      const flagsChanged =
        haveAtHome !== pantryItem.haveAtHome || needToBuy !== pantryItem.needToBuy

      return flagsChanged
        ? { ...pantryItem, haveAtHome, needToBuy, updatedAt: new Date().toISOString() }
        : pantryItem
    })

    await persistAndSync()
    uiStore.setSaving(false)
  }

  // TODO: Move local persistence to a shared application-state coordinator so
  // the Pantry store does not depend on the List store to save its state.
  async function persistAndSync() {
    const listStore = useListStore()
    listStore.persistToLocalStorage()
    await syncSharedState({ pantryItems: pantryItems.value })
  }

  return {
    pantryItems,
    hydrateItems,
    materializedPantryItems,
    itemsToBuy,
    pantryItemById,
    hasPantryItem,
    addItem,
    removeItem,
    setHaveAtHome,
    setNeedToBuy,
    setStaleAfterDays,
    checkItem,
    completePurchasedItems,
    createShoppingList,
    updateItemId,
    removeItemReference,
  }
})
