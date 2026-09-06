<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const { t } = useI18n()
const localePath = useLocalePath()
const listStore = useListStore()
const appStateStore = useAppStateStore()

useSeoDefaults({
  title: t('home.heroTitle'),
  description: t('home.heroSeoDescription'),
  path: '/',
})

onMounted(async () => {
  await appStateStore.loadState()
  const list = listStore.selectedList
  if (list) {
    navigateTo(localePath(`/lists/${list.id}`))
  }
})
</script>

<template>
  <v-container>
    <v-progress-circular
      class="mx-auto d-block my-16"
      :size="100"
      :width="5"
      color="lime"
      indeterminate
    />
  </v-container>
</template>
