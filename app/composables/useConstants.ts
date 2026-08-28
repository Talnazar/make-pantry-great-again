export const ROUTE_NAMES = {
  SHOPPING_LIST_SHOW: 'ShowShoppingList',
  SHOPPING_LIST_INDEX: 'IndexShoppingList',
  MANAGE_LISTS: 'ManageLists',
  MANAGE_ITEMS: 'ManageItems',
  MANAGE_CATEGORIES: 'ManageCategories',
  SETTINGS_INDEX: 'IndexSettings',
  HOME: 'Home',
} as const

export const NOTIFICATION = {
  EVENTS: {
    ERROR: 'notification.events.error',
    SUCCESS: 'notification.events.success',
    INFO: 'notification.events.info',
  },
} as const

export const useConstants = () => {
  const config = useRuntimeConfig()

  const APP = {
    NAME: config.public.appName as string,
    SUPPORT_EMAIL: config.public.appSupportEmail as string,
  }

  return {
    ROUTE_NAMES,
    NOTIFICATION,
    APP,
  }
}
