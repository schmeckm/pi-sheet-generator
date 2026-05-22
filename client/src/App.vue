<template>
  <SapShell v-if="!isLogin">
    <router-view />
  </SapShell>
  <router-view v-else />
  <ToastContainer />
  <ConfirmDialog />
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import SapShell from '@/components/sap/SapShell.vue';
import ToastContainer from '@/components/shared/ToastContainer.vue';
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue';

const route = useRoute();
const isLogin = computed(() => route.name === 'login');
</script>
