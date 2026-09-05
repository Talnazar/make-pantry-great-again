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
    dir: locale.value === 'he' ? 'rtl' : 'ltr', //Todo : is this the right way to do it? should we use a computed property instead?
  },
}))
</script>
