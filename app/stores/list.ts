import { onSnapshot, getDoc } from 'firebase/firestore'
import type { Unsubscribe, DocumentData } from 'firebase/firestore'
import { mdiDomain, mdiFormatListCheckbox, mdiWeightLifter } from '@mdi/js'
import { DEFAULT_CATEGORY } from './category'
import defaultCategoriesJson from '~/assets/categories.json'
import type {
  Item,
  Category,
  List,
  ListItem,
  MaterializedList,
  MaterializedListItem,
  SelectItem,
  UpdateItemRequest,
  UpsertListRequest,
} from '~/types/state'

const COLLECTION_STATE = 'states'

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

const CATEGORY_COLORS = [
  'red',
  'pink',
  'purple',
  'deep-purple',
  'indigo',
  'blue',
  'light-blue',
  'cyan',
  'green',
  'light-green',
  'lime',
  'yellow',
  'amber',
  'orange',
  'deep-orange',
  'brown',
  'blue-grey',
  'teal',
]

export const useListStore = defineStore('list', () => {
  const lists = ref<List[]>([])
  const selectedListId = ref('')
  const stateLoaded = ref(false)
  const loadingState = ref(false)

  let unsubscribeSnapshot: Unsubscribe | null = null

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

  // ─── Persistence helpers ───

  function persistToLocalStorage() {
    if (!import.meta.client) return

    try {
      const itemStore = useItemStore()
      const pantryStore = usePantryStore()
      const categoryStore = useCategoryStore()
      const uiStore = useUIStore()
      const settingsStore = useSettingsStore()

      const state = {
        lists: lists.value,
        selectedListId: selectedListId.value,
        stateLoaded: stateLoaded.value,
        loadingState: loadingState.value,
        items: itemStore.items,
        pantryItems: pantryStore.pantryItems,
        categories: categoryStore.categories,
        currency: settingsStore.currency,
        loading: uiStore.loading,
        saving: uiStore.saving,
        title: uiStore.title,
        notification: uiStore.notification,
        navDrawerOpen: uiStore.navDrawerOpen,
      }
      localStorage.setItem(COLLECTION_STATE, JSON.stringify(state))
    } catch {
      // Ignore localStorage errors
    }
  }

  async function saveState() {
    persistToLocalStorage()

    if (!stateLoaded.value) return

    const itemStore = useItemStore()
    const pantryStore = usePantryStore()
    const categoryStore = useCategoryStore()
    const settingsStore = useSettingsStore()

    await syncSharedState({
      lists: lists.value,
      selectedListId: selectedListId.value,
      items: itemStore.items,
      pantryItems: pantryStore.pantryItems,
      categories: categoryStore.categories,
      currency: settingsStore.currency,
    })
  }

  // ─── Hydration helpers ───

  function _hydrateStores(data: DocumentData, opts: { useNavDrawerFromData?: boolean } = {}) {
    const itemStore = useItemStore()
    const pantryStore = usePantryStore()
    const categoryStore = useCategoryStore()
    const settingsStore = useSettingsStore()
    const uiStore = useUIStore()

    lists.value = data.lists ?? lists.value
    selectedListId.value = data.selectedListId ?? selectedListId.value
    categoryStore.categories = data.categories ?? [{ ...DEFAULT_CATEGORY }]
    itemStore.items = data.items ?? itemStore.items
    if (data.pantryItems !== undefined) {
      pantryStore.hydrateItems(data.pantryItems)
    }
    settingsStore.currency = data.currency ?? settingsStore.currency

    if (opts.useNavDrawerFromData) {
      uiStore.navDrawerOpen = (data.navDrawerOpen ?? uiStore.navDrawerOpen) && !isMobile()
    }

    persistToLocalStorage()
  }

  // ─── Actions ───

  async function loadState() {
    if (stateLoaded.value) return

    const settingsStore = useSettingsStore()

    // Offline: fall back to the last state saved in localStorage
    if (!window.navigator.onLine && localStorage.getItem(COLLECTION_STATE) != null) {
      try {
        const stored = JSON.parse(localStorage.getItem(COLLECTION_STATE) ?? '')
        if (stored.items?.length > 0) {
          loadStateFromStore()
          return
        }
      } catch {
        // Fall through to Firestore loading
      }
    }

    const uiStore = useUIStore()

    // Keep the app in sync with the shared document in real time
    unsubscribeSnapshot = onSnapshot(sharedStateDoc(), async (snapshot) => {
      if (!snapshot.data()) return
      uiStore.setSaving(true)
      _hydrateStores(snapshot.data()!)
      uiStore.setSaving(false)
    })

    loadingState.value = true
    persistToLocalStorage()

    const stateSnapshot = await getDoc(sharedStateDoc())

    if (!stateSnapshot.exists()) {
      // First run: seed the shared document with defaults
      settingsStore.currency = await getDefaultCurrency()
      setDefaultItems()
      sanitizeState()
      loadingState.value = false
      persistToLocalStorage()

      const categoryStore = useCategoryStore()
      const itemStore = useItemStore()
      const pantryStore = usePantryStore()
      await syncSharedState({
        lists: lists.value,
        categories: categoryStore.categories,
        items: itemStore.items,
        pantryItems: pantryStore.pantryItems,
        currency: settingsStore.currency,
        selectedListId: selectedListId.value,
      })
      return
    }

    _hydrateStores(stateSnapshot.data()!, { useNavDrawerFromData: true })
    sanitizeState()
    loadingState.value = false
    persistToLocalStorage()
  }

  function loadStateFromStore() {
    try {
      const state = JSON.parse(localStorage.getItem(COLLECTION_STATE) ?? '')
      const itemStore = useItemStore()
      const pantryStore = usePantryStore()
      const categoryStore = useCategoryStore()
      const settingsStore = useSettingsStore()
      const uiStore = useUIStore()

      lists.value = state?.lists ?? lists.value
      categoryStore.categories = state?.categories ?? [{ ...DEFAULT_CATEGORY }]
      itemStore.items = state?.items ?? itemStore.items
      if (state?.pantryItems !== undefined) {
        pantryStore.hydrateItems(state.pantryItems)
      }
      settingsStore.currency = state?.currency ?? settingsStore.currency
      selectedListId.value = state?.selectedListId ?? selectedListId.value
      uiStore.navDrawerOpen = (state?.navDrawerOpen ?? uiStore.navDrawerOpen) && !isMobile()

      sanitizeState()
    } catch {
      // If localStorage parse fails, fall through
    }
  }

  function setDefaultItems() {
    const itemStore = useItemStore()
    const categoryStore = useCategoryStore()

    const newItems: Item[] = []
    const newCategories: Category[] = [{ ...DEFAULT_CATEGORY }]

    Object.entries(defaultCategoriesJson).forEach(([key, value], index) => {
      const categoryId = key.trim().toLowerCase()
      newCategories.push({
        color: CATEGORY_COLORS[index] || 'teal',
        id: categoryId,
        name: key,
      })

      value.forEach((itemName: string) => {
        newItems.push({
          unit: null,
          categoryId,
          id: itemName.trim().toLowerCase(),
          name: itemName
            .split(' ')
            .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase())
            .join(' '),
        })
      })
    })

    categoryStore.categories = newCategories
    itemStore.items = newItems
    persistToLocalStorage()
  }

  async function upsertList(request: UpsertListRequest) {
    const uiStore = useUIStore()

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

    persistToLocalStorage()

    await syncSharedState({ lists: lists.value })

    uiStore.addNotification({
      type: 'success',
      message: `${request.name} has been added successfully`,
    })
    uiStore.setSaving(false)
  }

  async function createListWithItems(request: UpsertListRequest, itemIds: string[]) {
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
    persistToLocalStorage()
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
    if (listExists(listId)) {
      selectedListId.value = listId
    }
    persistToLocalStorage()

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

    persistToLocalStorage()

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

    persistToLocalStorage()

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

    const listIndex = lists.value.findIndex((l) => l.id === selectedListId.value)
    if (listIndex !== -1) {
      lists.value[listIndex]!.items = lists.value[listIndex]!.items.filter(
        (li: ListItem) => li.itemId !== itemId,
      )
      lists.value = [...lists.value]
    }

    persistToLocalStorage()

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

    uiStore.setSaving(true)
    _setAddedToCart(itemId, true)
    persistToLocalStorage()

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

    uiStore.setSaving(true)
    _setAddedToCart(itemId, false)
    persistToLocalStorage()

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
    const cartItemIdsToFinish = cartItemIds(listId)

    const listIndex = lists.value.findIndex((l) => l.id === listId)
    if (listIndex !== -1) {
      pantryStore.completePurchasedItems(cartItemIdsToFinish, missingItemIdsToAdd)

      lists.value[listIndex]!.items = lists.value[listIndex]!.items.filter(
        (li: ListItem) => !li.addedToCart,
      )
      lists.value = [...lists.value]
    }

    persistToLocalStorage()

    uiStore.setSaving(true)
    await syncSharedState({ lists: lists.value, pantryItems: pantryStore.pantryItems })

    uiStore.addNotification({
      type: 'info',
      message: 'Your cart has been emptied successfully',
    })
    uiStore.setSaving(false)
  }

  async function toggleCartPanel() {
    const listIndex = lists.value.findIndex((l) => l.id === selectedListId.value)
    if (listIndex !== -1) {
      lists.value[listIndex]!.cartPanelOpen = !lists.value[listIndex]!.cartPanelOpen
      lists.value = [...lists.value]
    }

    persistToLocalStorage()

    await syncSharedState({ lists: lists.value })
  }

  function sanitizeState() {
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

    stateLoaded.value = true
    persistToLocalStorage()
  }

  function resetState() {
    if (unsubscribeSnapshot !== null) {
      unsubscribeSnapshot()
      unsubscribeSnapshot = null
    }

    const categoryStore = useCategoryStore()
    const itemStore = useItemStore()
    const pantryStore = usePantryStore()
    const uiStore = useUIStore()

    lists.value = []
    selectedListId.value = ''
    categoryStore.categories = [{ ...DEFAULT_CATEGORY }]
    itemStore.items = []
    pantryStore.pantryItems = []
    stateLoaded.value = false
    uiStore.navDrawerOpen = false

    if (import.meta.client) {
      localStorage.removeItem(COLLECTION_STATE)
    }
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
    stateLoaded,
    loadingState,
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
    loadState,
    loadStateFromStore,
    setDefaultItems,
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
    saveState,
    persistToLocalStorage,
    resetState,
  }
})
