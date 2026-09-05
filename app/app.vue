<template>
  <div>
    <NuxtPwaManifest />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
const { locale } = useI18n()

useHead(() => ({
  htmlAttrs: {
    lang: locale.value,
    dir: locale.value === 'he' ? 'rtl' : 'ltr', //Todo : how to change it to support more rtl languages?
  },
}))
</script>
