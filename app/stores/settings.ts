import type { AppData, SelectItem } from '~/types/state'

export const useSettingsStore = defineStore('settings', () => {
  const currency = ref(DEFAULT_CURRENCY)

  const currencySymbol = computed((): string => {
    const symbol =
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency.value,
      })
        .formatToParts(0.0)
        .find((part) => part.type === 'currency')?.value || '$'
    return symbol.replace('US$', '$').replace('CA$', 'CAD')
  })

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.value,
    })
      .format(value)
      .replace('US$', '$')
      .replace('CA$', 'CAD')
  }

  const currencySelectItems = computed((): SelectItem[] => {
    return [...CURRENCY_LIST]
      .sort((a, b) => a.description.localeCompare(b.description))
      .map((c) => ({
        title: c.description,
        value: c.code,
      }))
  })

  const appData = computed((): AppData => {
    const config = useRuntimeConfig()
    let url = (config.public.siteUrl as string) || ''
    if (url.length > 0 && url[url.length - 1] === '/') {
      url = url.substring(0, url.length - 1)
    }
    return {
      url,
      name: (config.public.appName as string) || 'Pantry',
    }
  })

  async function setCurrency(newCurrency: string) {
    const uiStore = useUIStore()

    uiStore.setSaving(true)
    currency.value = newCurrency

    const listStore = useListStore()
    listStore.persistToLocalStorage()

    if (listStore.stateLoaded) {
      await syncSharedState({ currency: currency.value })
    }

    uiStore.addNotification({
      type: 'success',
      message: 'Currency has been set successfully',
    })
    uiStore.setSaving(false)
  }

  function resetSettings() {
    currency.value = DEFAULT_CURRENCY
  }

  return {
    currency,
    currencySymbol,
    formatCurrency,
    currencySelectItems,
    appData,
    setCurrency,
    resetSettings,
  }
})
