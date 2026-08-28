<template>
  <v-app>
    <v-layout>
      <v-app-bar :color="isDark ? undefined : 'primary'">
        <v-app-bar-nav-icon @click="navDrawerOpen = !navDrawerOpen" />

        <v-container
          class="position-absolute h-100 d-flex align-center"
          :style="{
            pointerEvents: 'none',
            left: navDrawerOpen && mdAndUp ? '256px' : '0',
            right: '0',
            transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }"
        >
          <v-row>
            <v-col cols="12" lg="6" md="8" offset-md="2" offset-lg="3">
              <span
                :class="{ 'ml-9 text-headline-large': !mdAndUp, 'text-display-small': mdAndUp }"
                style="pointer-events: auto"
                >{{ uiStore.title }}</span
              >
            </v-col>
          </v-row>
        </v-container>

        <v-spacer />

        <v-progress-circular
          v-if="uiStore.saving"
          indeterminate
          size="24"
          width="2"
          color="primary"
          class="mr-4"
        />

        <!-- Settings -->
        <v-btn icon class="mr-2" :to="localePath('/settings')">
          <v-icon :icon="mdiCog" />
        </v-btn>
      </v-app-bar>

      <v-navigation-drawer v-model="navDrawerOpen">
        <!-- Shopping lists -->
        <v-list nav prepend-gap="16" color="primary">
          <v-list-item
            v-for="list in lists"
            :key="list.id"
            :to="localePath(`/lists/${list.id}`)"
            lines="two"
            color="primary"
            link
          >
            <template #prepend>
              <v-icon size="x-large">{{ iconMap(list.icon) }}</v-icon>
            </template>
            <v-list-item-title class="text-body-large">{{ list.name }}</v-list-item-title>
            <v-list-item-subtitle>
              {{
                list.items.length === 1
                  ? t('list.itemCountSingular', { count: 1 })
                  : t('list.itemCount', { count: list.items.length })
              }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>

        <v-divider class="my-2" />

        <!-- Add List button -->
        <div class="w-100 text-center my-4">
          <AddListButton />
        </div>

        <v-divider />

        <!-- Manage navigation items -->
        <v-list nav rounded prepend-gap="16" color="primary">
          <v-list-item :to="localePath('/manage/lists')" link>
            <template #prepend>
              <v-icon :icon="mdiPlaylistEdit" />
            </template>
            <v-list-item-title class="text-body-large">{{
              t('nav.manageLists')
            }}</v-list-item-title>
          </v-list-item>

          <v-list-item :to="localePath('/manage/categories')" link>
            <template #prepend>
              <v-icon :icon="mdiShapeOutline" />
            </template>
            <v-list-item-title class="text-body-large">
              {{ t('nav.manageCategories') }}
            </v-list-item-title>
          </v-list-item>

          <v-list-item :to="localePath('/manage/items')" link>
            <template #prepend>
              <v-icon :icon="mdiArchiveCogOutline" />
            </template>
            <v-list-item-title class="text-body-large">{{
              t('nav.manageItems')
            }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-navigation-drawer>

      <v-main>
        <slot />

        <v-snackbar
          v-model="uiStore.isNotificationActive"
          :color="uiStore.notification.type"
          :timeout="uiStore.notification.timeout"
          variant="tonal"
        >
          <v-icon
            v-if="uiStore.notification.type === 'success'"
            :icon="mdiCheck"
            :color="uiStore.notification.type"
            class="mr-2"
          />
          <v-icon
            v-if="uiStore.notification.type === 'info'"
            :icon="mdiInformation"
            :color="uiStore.notification.type"
            class="mr-2"
          />
          {{ uiStore.notification.message }}

          <template #actions>
            <v-btn
              :color="uiStore.notification.type"
              variant="tonal"
              @click="uiStore.disableNotification()"
            >
              {{ t('common.close') }}
            </v-btn>
          </template>
        </v-snackbar>

        <PwaReloadPrompt />
      </v-main>
    </v-layout>
  </v-app>
</template>

<script setup lang="ts">
import {
  mdiArchiveCogOutline,
  mdiCheck,
  mdiCog,
  mdiInformation,
  mdiPlaylistEdit,
  mdiShapeOutline,
} from '@mdi/js'

const { t } = useI18n()
const localePath = useLocalePath()
const uiStore = useUIStore()
const { mdAndUp, mobile } = useVDisplay()
const theme = useVTheme()

const isDark = computed(() => theme.global.current.value.dark)

const listStore = useListStore()
const lists = computed(() => listStore.lists)

const navDrawerOpen = computed({
  get: () => uiStore.navDrawerOpen,
  set: (value: boolean) => {
    uiStore.setNavDrawer(value, !mobile.value)
  },
})

const iconMap = (iconName: string): string => listStore.listIcon(iconName)

onMounted(async () => {
  // Restore saved theme
  const savedTheme = localStorage.getItem('hepilo-theme')
  if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
    theme.change(savedTheme)
  }

  // Load state so the nav drawer lists are populated
  await listStore.loadState()
})
</script>
