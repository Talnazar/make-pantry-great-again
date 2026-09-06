import { mdiDomain, mdiFormatListCheckbox, mdiWeightLifter } from '@mdi/js'
import type {
  Item,
  List,
  ListItem,
  MaterializedList,
  MaterializedListItem,
  SelectItem,
  UpdateItemRequest,
  UpsertListRequest,
} from '~/types/state'

export const LIST_ICON_DEFAULT = 'list'
const LIST_ICONS = new Map<string, string>([
  ['list', mdiFormatListCheckbox],
  ['work', mdiDomain],
  ['fitness', mdiWeightLifter],
])

const LIST_DEFAULT: List = {
  name: 'Shopping List',
  id: crypto.randomUUID(),
  items: [],
  cartPanelOpen: true,
  icon: LIST_ICON_DEFAULT,
}

export const useListStore = defineStore('list', () => {
  const lists = ref<List[]>([])
  const selectedListId = ref('')

  // ─── Getters ───

  const selectedList = computed((): List => {
    const found = lists.value.find((list: List) => list.id === selectedListId.value)

    if (found === undefined) {
      return LIST_DEFAULT
    }
    return found
  })

  const selectedListIsValid = computed((): boolean => {
    return lists.value.find((list: List) => list.id === selectedListId.value) !== undefined
  })

  function listExists(listId: string): boolean {
    return listById(listId) !== undefined
  }

  function listById(listId: string): List | undefined {
    return lists.value.find((list: List) => list.id === listId)
  }

  function cartItemIds(listId: string): string[] {
    const list = listById(listId)
    if (!list) return []

    return [...new Set(list.items.filter((li) => li.addedToCart).map((li) => li.itemId))]
  }

  function listIcon(name: string): string {
    if (LIST_ICONS.has(name)) {
      return LIST_ICONS.get(name)!
    }
    return LIST_ICONS.get(LIST_ICON_DEFAULT)!
  }

  const listIconSelectItems = computed((): SelectItem[] => {
    const items: SelectItem[] = []
    LIST_ICONS.forEach((_icon, name) => {
      items.push({
        value: name,
        title: name.slice(0, 1).toUpperCase() + name.slice(1).toLowerCase(),
      })
    })
    return items
  })

  function listHasItemId(itemId: string): boolean {
    return selectedList.value.items.find((li: ListItem) => li.itemId === itemId) !== undefined
  }

  function ItemIdIsInCart(itemId: string): boolean {
    return (
      selectedList.value.items.find((li: ListItem) => li.itemId === itemId && li.addedToCart) !==
      undefined
    )
  }

  function materializedList(addedToCart: boolean): MaterializedList {
    const itemStore = useItemStore()
    const categoryStore = useCategoryStore()
    const result: MaterializedList = []

    if (lists.value.length === 0) return result

    const filteredItems = selectedList.value.items.filter((li: ListItem) =>
      addedToCart ? li.addedToCart : !li.addedToCart,
    )

    const categoryNames = new Set<string>()
    filteredItems.forEach((li: ListItem) => {
      const item = itemStore.findItemById(li.itemId)
      if (!item) return
      const category = categoryStore.findCategoryById(item.categoryId)
      if (!category) return
      categoryNames.add(category.name.toUpperCase())
    })

    const sortedCategories = Array.from(categoryNames).sort()
    sortedCategories.forEach((catName: string) => {
      const category = categoryStore.findCategoryByName(catName)
      if (!category) return

      result.push({
        category,
        items: filteredItems
          .filter((li: ListItem) => {
            const item = itemStore.findItemById(li.itemId)
            if (!item) return false
            const itemCat = categoryStore.findCategoryById(item.categoryId)
            if (!itemCat) return false
            return itemCat.id === category.id
          })
          .map((li: ListItem): MaterializedListItem => ({
            listItem: li,
            item: itemStore.findItemById(li.itemId)!,
          }))
          .sort((a: MaterializedListItem, b: MaterializedListItem) =>
            a.item.name.localeCompare(b.item.name),
          ),
      })
    })

    return result
  }

  const listMaterializedItems = computed((): MaterializedList => materializedList(false))
  const cartMaterializedItems = computed((): MaterializedList => materializedList(true))

  const cartPanel = computed((): number => {
    return selectedList.value.cartPanelOpen ? 0 : -1
  })

  // ─── Actions ───

  async function upsertList(request: UpsertListRequest) {
    const uiStore = useUIStore()
    const appStateStore = useAppStateStore()

    uiStore.setSaving(true)

    let list = listById(request.id)
    if (!list) {
      list = {
        name: request.name,
        items: [],
        cartPanelOpen: true,
        id: request.id,
        icon: request.icon,
      }
    }

    list.icon = request.icon
    list.name = request.name

    const index = lists.value.findIndex((l) => l.id === list!.id)
    if (index === -1) {
      lists.value.push(list)
    } else {
      lists.value[index] = list
    }
    lists.value = [...lists.value]

    appStateStore.persistToLocalStorage()

    await syncSharedState({ lists: lists.value })

    uiStore.addNotification({
      type: 'success',
      message: `${request.name} has been added successfully`,
    })
    uiStore.setSaving(false)
  }

  async function createListWithItems(request: UpsertListRequest, itemIds: string[]) {
    const appStateStore = useAppStateStore()

    await upsertList(request)

    const list = listById(request.id)
    if (!list) return undefined

    list.items.push(
      ...itemIds.map((itemId): ListItem => ({
        itemId,
        notes: '',
        addedToCart: false,
        quantity: 1,
      })),
    )
    lists.value = [...lists.value]
    appStateStore.persistToLocalStorage()
    await syncSharedState({ lists: lists.value })

    return list.id
  }

  async function deleteList(listId: string) {
    const uiStore = useUIStore()

    uiStore.setSaving(true)

    if (lists.value.length < 2) {
      uiStore.addNotification({
        type: 'error',
        message: 'You cannot delete the only list',
      })
      uiStore.setSaving(false)
      return
    }

    const list = listById(listId)

    if (selectedListId.value === listId) {
      const other = lists.value.find((l) => l.id !== listId)
      if (other) selectedListId.value = other.id
    }

    lists.value = lists.value.filter((l) => l.id !== listId)
    sanitizeState()

    await syncSharedState({ lists: lists.value })

    uiStore.addNotification({
      type: 'info',
      message: `${list?.name ?? 'List'} has been deleted successfully`,
    })
    uiStore.setSaving(false)
  }

  async function setSelectedListId(listId: string) {
    const appStateStore = useAppStateStore()

    if (listExists(listId)) {
      selectedListId.value = listId
    }
    appStateStore.persistToLocalStorage()

    await syncSharedState({ lists: lists.value, selectedListId: listId })
  }

  function setTitleByListId(listId: string) {
    const uiStore = useUIStore()
    const list = listById(listId)
    if (list) {
      uiStore.setTitle(list.name)
    }
  }

  async function addItem(name: string) {
    const uiStore = useUIStore()
    const itemStore = useItemStore()
    const appStateStore = useAppStateStore()

    uiStore.setSaving(true)

    if (!name.trim()) {
      uiStore.setSaving(false)
      return
    }

    if (name.trim().length > 50) {
      uiStore.addNotification({
        type: 'error',
        message: 'You name must be maximum 50 characters',
      })
      uiStore.setSaving(false)
      return
    }

    let quantity = 1
    const nameQuantity = parseFloat(name.split(' ')[0]!)
    if (!isNaN(nameQuantity) && nameQuantity > 0) {
      quantity = nameQuantity
      name = name.split(' ').slice(1).join(' ')
    }

    const itemId = itemStore.nameToId(name)

    if (!itemStore.hasItem(name)) {
      const item: Item = {
        id: itemId,
        name: name.trim(),
        unit: null,
        categoryId: itemStore.findCategoryIdByItemId(itemId),
      }
      const idx = itemStore.items.findIndex((i) => i.id === item.id)
      if (idx === -1) {
        itemStore.items.push(item)
      } else {
        itemStore.items[idx] = item
      }
      itemStore.items = [...itemStore.items]
    }

    if (!listHasItemId(itemId)) {
      const listItem: ListItem = {
        itemId,
        notes: '',
        addedToCart: false,
        quantity,
      }
      const listIndex = lists.value.findIndex((l) => l.id === selectedListId.value)
      if (listIndex !== -1) {
        lists.value[listIndex]!.items.push(listItem)
        lists.value = [...lists.value]
      }
    }

    if (ItemIdIsInCart(itemId)) {
      _setAddedToCart(itemId, false)
    }

    appStateStore.persistToLocalStorage()

    const categoryStore = useCategoryStore()
    await syncSharedState({
      lists: lists.value,
      categories: categoryStore.categories,
      items: itemStore.items,
    })

    uiStore.addNotification({
      type: 'success',
      message: `${name} has been added successfully`,
    })
    uiStore.setSaving(false)
  }

  async function updateItem(request: UpdateItemRequest) {
    const uiStore = useUIStore()
    const itemStore = useItemStore()
    const categoryStore = useCategoryStore()
    const appStateStore = useAppStateStore()

    uiStore.setSaving(true)

    const item = itemStore.findItemById(request.itemId)
    if (item) {
      item.name = request.name.trim()
      item.categoryId = request.categoryId
      item.unit = itemStore.isValidUnit(request.unit) ? request.unit : null

      const idx = itemStore.items.findIndex((i) => i.id === item!.id)
      if (idx !== -1) {
        itemStore.items[idx] = item
      }
      itemStore.items = [...itemStore.items]
    }

    // Upsert list item
    const listItem: ListItem = {
      itemId: request.itemId,
      notes: request.notes,
      addedToCart: request.addedToCart,
      quantity: request.quantity,
    }
    _upsertListItem(listItem)

    // Update ID if name changed
    const newId = itemStore.nameToId(request.name)
    if (newId !== request.itemId) {
      itemStore.items = itemStore.items.map((i: Item) => {
        if (i.id === request.itemId) i.id = newId
        return i
      })
      lists.value = lists.value.map((list) => {
        list.items = list.items.map((li: ListItem) => {
          if (li.itemId === request.itemId) li.itemId = newId
          return li
        })
        return list
      })
      lists.value = [...lists.value]
    }

    appStateStore.persistToLocalStorage()

    await syncSharedState({
      lists: lists.value,
      categories: categoryStore.categories,
      items: itemStore.items,
    })
    uiStore.setSaving(false)
  }

  async function deleteListItem(itemId: string) {
    const uiStore = useUIStore()
    const itemStore = useItemStore()
    const appStateStore = useAppStateStore()

    const listIndex = lists.value.findIndex((l) => l.id === selectedListId.value)
    if (listIndex !== -1) {
      lists.value[listIndex]!.items = lists.value[listIndex]!.items.filter(
        (li: ListItem) => li.itemId !== itemId,
      )
      lists.value = [...lists.value]
    }

    appStateStore.persistToLocalStorage()

    const item = itemStore.findItemById(itemId)

    uiStore.setSaving(true)
    await syncSharedState({ lists: lists.value })

    uiStore.addNotification({
      type: 'info',
      message: `${item?.name ?? 'Item'} has been deleted successfully`,
    })
    uiStore.setSaving(false)
  }

  async function addToCart(itemId: string) {
    const uiStore = useUIStore()
    const itemStore = useItemStore()
    const appStateStore = useAppStateStore()

    uiStore.setSaving(true)
    _setAddedToCart(itemId, true)
    appStateStore.persistToLocalStorage()

    await syncSharedState({ lists: lists.value })

    const item = itemStore.findItemById(itemId)
    if (item) {
      uiStore.addNotification({
        type: 'success',
        message: `${item.name} added to cart`,
      })
    }
    uiStore.setSaving(false)
  }

  async function removeFromCart(itemId: string) {
    const uiStore = useUIStore()
    const itemStore = useItemStore()
    const appStateStore = useAppStateStore()

    uiStore.setSaving(true)
    _setAddedToCart(itemId, false)
    appStateStore.persistToLocalStorage()

    await syncSharedState({ lists: lists.value })

    const item = itemStore.findItemById(itemId)
    if (item) {
      uiStore.addNotification({
        type: 'success',
        message: `${item.name} removed from cart`,
      })
    }
    uiStore.setSaving(false)
  }

  async function finishAndClearCart(listId: string, missingItemIdsToAdd: string[] = []) {
    const uiStore = useUIStore()
    const pantryStore = usePantryStore()
    const appStateStore = useAppStateStore()
    const cartItemIdsToFinish = cartItemIds(listId)

    const listIndex = lists.value.findIndex((l) => l.id === listId)
    if (listIndex !== -1) {
      pantryStore.completePurchasedItems(cartItemIdsToFinish, missingItemIdsToAdd)

      lists.value[listIndex]!.items = lists.value[listIndex]!.items.filter(
        (li: ListItem) => !li.addedToCart,
      )
      lists.value = [...lists.value]
    }

    appStateStore.persistToLocalStorage()

    uiStore.setSaving(true)
    await syncSharedState({ lists: lists.value, pantryItems: pantryStore.pantryItems })

    uiStore.addNotification({
      type: 'info',
      message: 'Your cart has been emptied successfully',
    })
    uiStore.setSaving(false)
  }

  async function toggleCartPanel() {
    const appStateStore = useAppStateStore()
    const listIndex = lists.value.findIndex((l) => l.id === selectedListId.value)
    if (listIndex !== -1) {
      lists.value[listIndex]!.cartPanelOpen = !lists.value[listIndex]!.cartPanelOpen
      lists.value = [...lists.value]
    }

    appStateStore.persistToLocalStorage()

    await syncSharedState({ lists: lists.value })
  }

  // Repairs list data that may be missing or stale after hydration: guarantees a
  // valid selected list and drops icon names the app no longer knows about.
  function sanitizeState() {
    const appStateStore = useAppStateStore()

    // Create default list if selected list is invalid
    if (!selectedListIsValid.value) {
      if (lists.value.length > 0) {
        selectedListId.value = lists.value[0]!.id
      } else {
        lists.value.push({ ...LIST_DEFAULT })
        selectedListId.value = LIST_DEFAULT.id
      }
    }

    // Sanitize icon names
    lists.value = lists.value.map((list) => {
      if (!LIST_ICONS.has(list.icon)) {
        list.icon = LIST_ICON_DEFAULT
      }
      return list
    })

    appStateStore.persistToLocalStorage()
  }

  // ─── Private helpers ───

  function _setAddedToCart(itemId: string, addedToCart: boolean) {
    const listIndex = lists.value.findIndex((l) => l.id === selectedListId.value)
    if (listIndex === -1) return
    lists.value[listIndex]!.items = lists.value[listIndex]!.items.map((li: ListItem) => {
      if (li.itemId === itemId) li.addedToCart = addedToCart
      return li
    })
    lists.value = [...lists.value]
  }

  function _upsertListItem(listItem: ListItem) {
    const listIndex = lists.value.findIndex((l) => l.id === selectedListId.value)
    if (listIndex === -1) return
    const index = lists.value[listIndex]!.items.findIndex(
      (li: ListItem) => li.itemId === listItem.itemId,
    )
    if (index === -1) {
      lists.value[listIndex]!.items.push(listItem)
    } else {
      lists.value[listIndex]!.items[index] = listItem
    }
    lists.value = [...lists.value]
  }

  return {
    // State
    lists,
    selectedListId,
    // Getters
    selectedList,
    selectedListIsValid,
    listExists,
    listById,
    listIcon,
    listIconSelectItems,
    cartItemIds,
    listHasItemId,
    ItemIdIsInCart,
    materializedList,
    listMaterializedItems,
    cartMaterializedItems,
    cartPanel,
    // Actions
    upsertList,
    createListWithItems,
    deleteList,
    setSelectedListId,
    setTitleByListId,
    addItem,
    updateItem,
    deleteListItem,
    addToCart,
    removeFromCart,
    finishAndClearCart,
    toggleCartPanel,
    sanitizeState,
  }
})
