export type List = {
  name: string
  icon: string
  id: string
  cartPanelOpen: boolean
  items: Array<ListItem>
}

type NotificationType = 'error' | 'success' | 'info'

export interface Notification {
  message: string
  timeout: number
  active: boolean
  type: NotificationType
}

export interface SelectItem {
  title: string
  value: string
  unit?: string | null
}

export type TimeFormat = '12-hour' | '24-hour'

export interface Item {
  id: string
  name: string
  unit: string | null
  categoryId: string
}

export type Category = {
  id: string
  name: string
  color: string
}

export type ListItem = {
  itemId: string
  notes: string
  addedToCart: boolean
  quantity: number
}

export type PantryItem = {
  itemId: string
  haveAtHome: boolean
  needToBuy: boolean
  updatedAt: string
  staleAfterDays: number | null
}

export interface MaterializedListItem {
  item: Item
  listItem: ListItem
}

export interface MaterializedListElement {
  category: Category
  items: Array<MaterializedListItem>
}

export type MaterializedList = Array<MaterializedListElement>

export interface UpsertCategoryRequest {
  id: string
  name: string
  color: string
}

export interface UpsertListRequest {
  id: string
  name: string
  icon: string
}

export interface UpsertItemRequest {
  itemId: string
  categoryId: string
  unit: string | null
  name: string
}

export type AppData = {
  url: string
  name: string
}

export interface UpdateItemRequest {
  name: string
  categoryId: string
  quantity: number
  addedToCart: boolean
  notes: string
  unit: string | null
  itemId: string
}

export interface NotificationRequest {
  message: string
  type: NotificationType
}

export interface State {
  loading: boolean
  saving: boolean
  stateLoaded: boolean
  title: string
  categories: Array<Category>
  selectedListId: string
  lists: Array<List>
  items: Array<Item>
  pantryItems: Array<PantryItem>
  currency: string
  timeFormat: TimeFormat
  defaultStaleAfterDays: number
  notification: Notification
  navDrawerOpen: boolean
}
