<script setup lang="ts">
import { mdiCartPlus, mdiClose, mdiDelete, mdiPlus } from '@mdi/js'

const { t } = useI18n()
const listStore = useListStore()
const itemStore = useItemStore()
const pantryStore = usePantryStore()
const uiStore = useUIStore()
const localePath = useLocalePath()

useHead({
  title: () => t('pantry.title'),
})

definePageMeta({
  layout: 'default',
})

const selectedCatalogItemId = ref<string | null>(null)
const exportDialog = ref(false)
const selectedExportItemIds = ref<string[]>([])
const exportListName = ref('')
const creatingList = ref(false)
const haveAtHomeFilter = ref('all')
const needToBuyFilter = ref('all')
const sortOption = ref('nameAsc')

const availableItems = computed(() =>
  itemStore.items
    .filter((item) => !pantryStore.hasPantryItem(item.id))
    .sort((a, b) => a.name.localeCompare(b.name)),
)

const filterOptions = computed(() => [
  { title: t('pantry.filterAll'), value: 'all' },
  { title: t('pantry.filterYes'), value: 'true' },
  { title: t('pantry.filterNo'), value: 'false' },
])

const filteredPantryItems = computed(() =>
  pantryStore.materializedPantryItems.filter(({ pantryItem }) => {
    const matchesHaveAtHome =
      haveAtHomeFilter.value === 'all' ||
      pantryItem.haveAtHome === (haveAtHomeFilter.value === 'true')
    const matchesNeedToBuy =
      needToBuyFilter.value === 'all' || pantryItem.needToBuy === (needToBuyFilter.value === 'true')

    return matchesHaveAtHome && matchesNeedToBuy
  }),
)

const sortOptions = computed(() => [
  { title: t('pantry.sortNameAsc'), value: 'nameAsc' },
  { title: t('pantry.sortNameDesc'), value: 'nameDesc' },
])

const sortedPantryItems = computed(() => {
  return [...filteredPantryItems.value].sort((a, b) => {
    const comparison = a.item.name.localeCompare(b.item.name)
    return sortOption.value === 'nameDesc' ? -comparison : comparison
  })
})

function openExportDialog() {
  selectedExportItemIds.value = pantryStore.itemsToBuy.map(({ pantryItem }) => pantryItem.itemId)
  const today = new Date()
  const date = [today.getFullYear(), today.getMonth() + 1, today.getDate()]
    .map((part) => part.toString().padStart(2, '0'))
    .join('-')
  exportListName.value = `${t('pantry.defaultListName')} - ${date}`
  exportDialog.value = true
}

function closeExportDialog() {
  exportDialog.value = false
}

async function addSelectedItem() {
  if (!selectedCatalogItemId.value) return

  await pantryStore.addItem(selectedCatalogItemId.value)
  selectedCatalogItemId.value = null
}

async function createShoppingList() {
  creatingList.value = true
  const listId = await pantryStore.createShoppingList(
    selectedExportItemIds.value,
    exportListName.value,
  )
  creatingList.value = false

  if (!listId) return

  exportDialog.value = false
  await navigateTo(localePath(`/lists/${listId}`))
}

onMounted(async () => {
  await listStore.loadState()
  uiStore.setTitle(t('pantry.title'))
})
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12" lg="6" md="8" offset-md="2" offset-lg="3">
        <div class="d-flex align-center ga-3 mb-4">
          <v-select
            v-model="selectedCatalogItemId"
            :items="availableItems"
            item-title="name"
            item-value="id"
            :label="t('pantry.addItem')"
            :placeholder="t('pantry.chooseCatalogItem')"
            variant="outlined"
            density="comfortable"
            hide-details
            clearable
          />
          <v-btn
            color="primary"
            :disabled="!selectedCatalogItemId || uiStore.saving"
            @click="addSelectedItem"
          >
            <v-icon start :icon="mdiPlus" />
            {{ t('pantry.addItem') }}
          </v-btn>
        </div>

        <div class="d-flex align-center ga-3 mb-4">
          <v-select
            v-model="haveAtHomeFilter"
            :items="filterOptions"
            :label="t('pantry.haveAtHomeFilter')"
            variant="outlined"
            density="comfortable"
            hide-details
          />
          <v-select
            v-model="needToBuyFilter"
            :items="filterOptions"
            :label="t('pantry.needToBuyFilter')"
            variant="outlined"
            density="comfortable"
            hide-details
          />
          <v-select
            v-model="sortOption"
            :items="sortOptions"
            :label="t('pantry.sortBy')"
            variant="outlined"
            density="comfortable"
            hide-details
          />
        </div>

        <div class="d-flex justify-end mb-4">
          <v-btn
            color="primary"
            variant="tonal"
            :disabled="pantryStore.itemsToBuy.length === 0 || uiStore.saving"
            @click="openExportDialog"
          >
            <v-icon start :icon="mdiCartPlus" />
            {{ t('pantry.createShoppingList') }}
          </v-btn>
        </div>

        <v-progress-circular
          v-if="!listStore.stateLoaded"
          class="mx-auto d-block my-16"
          :size="100"
          :width="5"
          color="lime"
          indeterminate
        />

        <v-card v-else flat>
          <v-list v-if="sortedPantryItems.length > 0" lines="two" class="px-0">
            <template
              v-for="(materializedItem, index) in sortedPantryItems"
              :key="materializedItem.item.id"
            >
              <v-list-item>
                <v-list-item-title>{{ materializedItem.item.name }}</v-list-item-title>
                <template #append>
                  <div class="d-flex align-center ga-2">
                    <v-checkbox
                      :model-value="materializedItem.pantryItem.haveAtHome"
                      :label="t('pantry.haveAtHome')"
                      hide-details
                      color="primary"
                      @update:model-value="
                        pantryStore.setHaveAtHome(materializedItem.item.id, $event ?? false)
                      "
                    />
                    <v-checkbox
                      :model-value="materializedItem.pantryItem.needToBuy"
                      :label="t('pantry.needToBuy')"
                      hide-details
                      color="primary"
                      @update:model-value="
                        pantryStore.setNeedToBuy(materializedItem.item.id, $event ?? false)
                      "
                    />
                    <v-tooltip location="bottom">
                      <template #activator="{ props: tooltipProps }">
                        <v-btn
                          v-bind="tooltipProps"
                          :icon="mdiDelete"
                          color="error"
                          variant="text"
                          @click="pantryStore.removeItem(materializedItem.item.id)"
                        />
                      </template>
                      <span>{{
                        t('pantry.removeItem', { name: materializedItem.item.name })
                      }}</span>
                    </v-tooltip>
                  </div>
                </template>
              </v-list-item>
              <v-divider v-if="index < sortedPantryItems.length - 1" />
            </template>
          </v-list>
          <div v-else class="text-center py-12 text-medium-emphasis">
            <p class="text-title-large mb-2">
              {{
                pantryStore.materializedPantryItems.length > 0
                  ? t('pantry.noMatchingItems')
                  : t('pantry.emptyTitle')
              }}
            </p>
            <p v-if="pantryStore.materializedPantryItems.length === 0">
              {{ t('pantry.emptyDescription') }}
            </p>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="exportDialog" max-width="520">
      <v-card>
        <v-card-title class="d-flex align-center">
          {{ t('pantry.createShoppingList') }}
          <v-spacer />
          <v-btn
            :icon="mdiClose"
            color="warning"
            variant="text"
            density="comfortable"
            @click="closeExportDialog"
          />
        </v-card-title>
        <v-card-text>
          <p class="mb-3">{{ t('pantry.reviewDescription') }}</p>
          <v-text-field
            v-model="exportListName"
            :label="t('pantry.listName')"
            variant="outlined"
            class="mb-3"
            hide-details
          />
          <v-checkbox
            v-for="materializedItem in pantryStore.itemsToBuy"
            :key="materializedItem.item.id"
            v-model="selectedExportItemIds"
            :label="materializedItem.item.name"
            :value="materializedItem.item.id"
            hide-details
            color="primary"
          />
        </v-card-text>
        <v-card-actions>
          <v-btn
            color="primary"
            variant="flat"
            :disabled="selectedExportItemIds.length === 0 || creatingList"
            :loading="creatingList"
            @click="createShoppingList"
          >
            {{ t('list.createList') }}
          </v-btn>
          <v-spacer />
          <v-btn color="warning" variant="text" @click="closeExportDialog">
            {{ t('common.cancel') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
