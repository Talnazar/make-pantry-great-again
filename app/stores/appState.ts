import { onSnapshot, getDoc } from 'firebase/firestore'
import type { Unsubscribe, DocumentData } from 'firebase/firestore'
import { CATEGORY_COLORS, DEFAULT_CATEGORY } from './category'
import defaultCategoriesJson from '~/assets/categories.json'
import type { Category, Item } from '~/types/state'

// The single localStorage entry mirroring the whole app state. Same name as
// COLLECTION_STATE, the Firestore collection holding the shared document.
const STORAGE_KEY = 'states'

// Bootstrap and persistence for the whole app state. The domain stores (list,
// item, category, pantry, settings, ui) own their slice of the data and call
// persistToLocalStorage() here after mutating; this store is what reads and
// writes those slices as one document, locally and in Firestore.
export const useAppStateStore = defineStore('appState', () => {
  const stateLoaded = ref(false)

  let unsubscribeSnapshot: Unsubscribe | null = null

  // ─── Local persistence ───

  function persistToLocalStorage() {
    if (!import.meta.client) return

    try {
      const listStore = useListStore()
      const itemStore = useItemStore()
      const pantryStore = usePantryStore()
      const categoryStore = useCategoryStore()
      const uiStore = useUIStore()
      const settingsStore = useSettingsStore()

      const state = {
        lists: listStore.lists,
        selectedListId: listStore.selectedListId,
        stateLoaded: stateLoaded.value,
        items: itemStore.items,
        pantryItems: pantryStore.pantryItems,
        categories: categoryStore.categories,
        currency: settingsStore.currency,
        timeFormat: settingsStore.timeFormat,
        defaultStaleAfterDays: settingsStore.defaultStaleAfterDays,
        loading: uiStore.loading,
        saving: uiStore.saving,
        title: uiStore.title,
        notification: uiStore.notification,
        navDrawerOpen: uiStore.navDrawerOpen,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignore localStorage errors
    }
  }

  // TODO: Unused — every mutation path persists and syncs its own slice instead.
  // Carried over from the List store; remove once we are sure nothing needs a
  // whole-state write.
  async function saveState() {
    persistToLocalStorage()

    if (!stateLoaded.value) return

    const listStore = useListStore()
    const itemStore = useItemStore()
    const pantryStore = usePantryStore()
    const categoryStore = useCategoryStore()
    const settingsStore = useSettingsStore()

    await syncSharedState({
      lists: listStore.lists,
      selectedListId: listStore.selectedListId,
      items: itemStore.items,
      pantryItems: pantryStore.pantryItems,
      categories: categoryStore.categories,
      currency: settingsStore.currency,
      timeFormat: settingsStore.timeFormat,
      defaultStaleAfterDays: settingsStore.defaultStaleAfterDays,
    })
  }

  // ─── Hydration helpers ───

  function _hydrateStores(data: DocumentData, opts: { useNavDrawerFromData?: boolean } = {}) {
    const listStore = useListStore()
    const itemStore = useItemStore()
    const pantryStore = usePantryStore()
    const categoryStore = useCategoryStore()
    const settingsStore = useSettingsStore()
    const uiStore = useUIStore()

    listStore.lists = data.lists ?? listStore.lists
    listStore.selectedListId = data.selectedListId ?? listStore.selectedListId
    categoryStore.categories = data.categories ?? [{ ...DEFAULT_CATEGORY }]
    itemStore.items = data.items ?? itemStore.items
    if (data.pantryItems !== undefined) {
      pantryStore.hydrateItems(data.pantryItems)
    }
    settingsStore.currency = data.currency ?? settingsStore.currency
    settingsStore.timeFormat = data.timeFormat ?? settingsStore.timeFormat
    settingsStore.defaultStaleAfterDays =
      data.defaultStaleAfterDays ?? settingsStore.defaultStaleAfterDays

    if (opts.useNavDrawerFromData) {
      uiStore.navDrawerOpen = (data.navDrawerOpen ?? uiStore.navDrawerOpen) && !isMobile()
    }

    persistToLocalStorage()
  }

  // ─── Actions ───

  async function loadState() {
    if (stateLoaded.value) return

    const listStore = useListStore()
    const settingsStore = useSettingsStore()

    // Offline: fall back to the last state saved in localStorage
    if (!window.navigator.onLine && localStorage.getItem(STORAGE_KEY) != null) {
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')
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

    persistToLocalStorage()

    const stateSnapshot = await getDoc(sharedStateDoc())

    if (!stateSnapshot.exists()) {
      // First run: seed the shared document with defaults
      settingsStore.currency = await getDefaultCurrency()
      setDefaultItems()
      listStore.sanitizeState()
      stateLoaded.value = true
      persistToLocalStorage()

      const categoryStore = useCategoryStore()
      const itemStore = useItemStore()
      const pantryStore = usePantryStore()
      await syncSharedState({
        lists: listStore.lists,
        categories: categoryStore.categories,
        items: itemStore.items,
        pantryItems: pantryStore.pantryItems,
        currency: settingsStore.currency,
        timeFormat: settingsStore.timeFormat,
        defaultStaleAfterDays: settingsStore.defaultStaleAfterDays,
        selectedListId: listStore.selectedListId,
      })
      return
    }

    _hydrateStores(stateSnapshot.data()!, { useNavDrawerFromData: true })
    listStore.sanitizeState()
    stateLoaded.value = true
    persistToLocalStorage()
  }

  function loadStateFromStore() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')
      const listStore = useListStore()
      const itemStore = useItemStore()
      const pantryStore = usePantryStore()
      const categoryStore = useCategoryStore()
      const settingsStore = useSettingsStore()
      const uiStore = useUIStore()

      listStore.lists = state?.lists ?? listStore.lists
      categoryStore.categories = state?.categories ?? [{ ...DEFAULT_CATEGORY }]
      itemStore.items = state?.items ?? itemStore.items
      if (state?.pantryItems !== undefined) {
        pantryStore.hydrateItems(state.pantryItems)
      }
      settingsStore.currency = state?.currency ?? settingsStore.currency
      settingsStore.timeFormat = state?.timeFormat ?? settingsStore.timeFormat
      settingsStore.defaultStaleAfterDays =
        state?.defaultStaleAfterDays ?? settingsStore.defaultStaleAfterDays
      listStore.selectedListId = state?.selectedListId ?? listStore.selectedListId
      uiStore.navDrawerOpen = (state?.navDrawerOpen ?? uiStore.navDrawerOpen) && !isMobile()

      listStore.sanitizeState()
      stateLoaded.value = true
    } catch {
      // If localStorage parse fails, fall through
    }
  }

  function setDefaultItems() {
    const itemStore = useItemStore()
    const categoryStore = useCategoryStore()
    const colors = Array.from(CATEGORY_COLORS)

    const newItems: Item[] = []
    const newCategories: Category[] = [{ ...DEFAULT_CATEGORY }]

    Object.entries(defaultCategoriesJson).forEach(([key, value], index) => {
      const categoryId = key.trim().toLowerCase()
      newCategories.push({
        color: colors[index] || 'teal',
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

  // TODO: Unused — nothing in the app clears the shared state today. Carried
  // over from the List store; remove unless we add a "reset" affordance.
  function resetState() {
    if (unsubscribeSnapshot !== null) {
      unsubscribeSnapshot()
      unsubscribeSnapshot = null
    }

    const listStore = useListStore()
    const categoryStore = useCategoryStore()
    const itemStore = useItemStore()
    const pantryStore = usePantryStore()
    const uiStore = useUIStore()

    listStore.lists = []
    listStore.selectedListId = ''
    categoryStore.categories = [{ ...DEFAULT_CATEGORY }]
    itemStore.items = []
    pantryStore.pantryItems = []
    stateLoaded.value = false
    uiStore.navDrawerOpen = false

    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return {
    stateLoaded,
    persistToLocalStorage,
    saveState,
    loadState,
    loadStateFromStore,
    setDefaultItems,
    resetState,
  }
})
