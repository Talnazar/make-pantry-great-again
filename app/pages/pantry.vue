<script setup lang="ts">
import { mdiCartPlus, mdiClose, mdiDelete, mdiPlus } from '@mdi/js'

const listStore = useListStore()
const itemStore = useItemStore()
const pantryStore = usePantryStore()
const uiStore = useUIStore()
const localePath = useLocalePath()

useHead({
  title: 'Pantry',
})

definePageMeta({
  layout: 'default',
})

const selectedCatalogItemId = ref<string | null>(null)
const exportDialog = ref(false)
const selectedExportItemIds = ref<string[]>([])
const creatingList = ref(false)

const availableItems = computed(() =>
  itemStore.items
    .filter((item) => !pantryStore.hasPantryItem(item.id))
    .sort((a, b) => a.name.localeCompare(b.name)),
)

function openExportDialog() {
  selectedExportItemIds.value = pantryStore.itemsToBuy.map(({ pantryItem }) => pantryItem.itemId)
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
  const listId = await pantryStore.createShoppingList(selectedExportItemIds.value)
  creatingList.value = false

  if (!listId) return

  exportDialog.value = false
  await navigateTo(localePath(`/lists/${listId}`))
}

onMounted(async () => {
  await listStore.loadState()
  uiStore.setTitle('Pantry')
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
            label="Add an item"
            placeholder="Choose an item from the catalog"
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
            Add
          </v-btn>
        </div>

        <div class="d-flex justify-end mb-4">
          <v-btn
            color="primary"
            variant="tonal"
            :disabled="pantryStore.itemsToBuy.length === 0 || uiStore.saving"
            @click="openExportDialog"
          >
            <v-icon start :icon="mdiCartPlus" />
            Create shopping list
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
          <v-list v-if="pantryStore.materializedPantryItems.length > 0" lines="two" class="px-0">
            <template
              v-for="(materializedItem, index) in pantryStore.materializedPantryItems"
              :key="materializedItem.item.id"
            >
              <v-list-item>
                <v-list-item-title>{{ materializedItem.item.name }}</v-list-item-title>
                <template #append>
                  <div class="d-flex align-center ga-2">
                    <v-checkbox
                      :model-value="materializedItem.pantryItem.haveAtHome"
                      label="Have at home"
                      hide-details
                      color="primary"
                      @update:model-value="
                        pantryStore.setHaveAtHome(materializedItem.item.id, $event ?? false)
                      "
                    />
                    <v-checkbox
                      :model-value="materializedItem.pantryItem.needToBuy"
                      label="Need to buy"
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
                      <span>Remove {{ materializedItem.item.name }}</span>
                    </v-tooltip>
                  </div>
                </template>
              </v-list-item>
              <v-divider v-if="index < pantryStore.materializedPantryItems.length - 1" />
            </template>
          </v-list>
          <div v-else class="text-center py-12 text-medium-emphasis">
            <p class="text-title-large mb-2">Your pantry is empty</p>
            <p>Add an item from the catalog to get started.</p>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="exportDialog" max-width="520">
      <v-card>
        <v-card-title class="d-flex align-center">
          Create shopping list
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
          <p class="mb-3">Select the items to include in this shopping list.</p>
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
            Create list
          </v-btn>
          <v-spacer />
          <v-btn color="warning" variant="text" @click="closeExportDialog">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
