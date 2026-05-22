import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useFeaturesStore } from '@/stores/features';

const PLANT_EXPLORER_ROUTE_NAMES = new Set(['plant-explorer', 'admin-plant-explorer']);

const routes = [
  { path: '/', redirect: '/chat' },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('@/views/ChatView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/digitalize',
    name: 'digitalize',
    component: () => import('@/views/DigitalizeView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/AdminDashboard.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' },
  },
  {
    path: '/admin/pi-sheets',
    name: 'admin-pi-sheets',
    component: () => import('@/views/PiSheetsView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' },
  },
  {
    path: '/admin/audit',
    name: 'admin-audit',
    component: () => import('@/views/AuditLogView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' },
  },
  {
    path: '/admin/process-graph',
    name: 'admin-process-graph',
    component: () => import('@/views/ProcessGraphView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' },
  },
  {
    path: '/admin/plant-explorer',
    name: 'admin-plant-explorer',
    component: () => import('@/views/PlantExplorerView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' },
  },
  {
    path: '/plant-explorer',
    name: 'plant-explorer',
    component: () => import('@/views/PlantExplorerView.vue'),
    meta: { requiresAuth: true, layout: 'default' },
  },
  {
    path: '/admin/repository',
    name: 'admin-repository',
    component: () => import('@/views/RepositoryView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' },
  },
  {
    path: '/admin/upload',
    name: 'admin-upload',
    component: () => import('@/views/UploadView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' },
  },
  {
    path: '/admin/prompts',
    name: 'admin-prompts',
    component: () => import('@/views/PromptConfigView.vue'),
    meta: { requiresAuth: true, requiresPromptAccess: true, layout: 'admin' },
  },
  {
    path: '/admin/knowledge',
    name: 'admin-knowledge',
    component: () => import('@/views/KnowledgeView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' },
  },
  {
    path: '/admin/equipment',
    name: 'admin-equipment',
    component: () => import('@/views/EquipmentView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' },
  },
  {
    path: '/admin/settings',
    name: 'admin-settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' },
  },
  {
    path: '/admin/help',
    name: 'admin-help',
    component: () => import('@/views/AdminHelpView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  auth.loadFromStorage();
  if (auth.isAuthenticated) {
    try {
      await auth.ensureProfile();
    } catch {
      /* token expired — login redirect below */
    }
  }
  if (to.meta.public) return true;
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresAdmin && !auth.isAdmin) {
    if (auth.canManagePrompts && to.name !== 'admin-prompts') {
      return { name: 'admin-prompts' };
    }
    return { name: 'chat' };
  }
  if (to.meta.requiresPromptAccess && !auth.canManagePrompts) {
    return { name: 'chat' };
  }
  if (auth.isAuthenticated && PLANT_EXPLORER_ROUTE_NAMES.has(to.name)) {
    const features = useFeaturesStore();
    try {
      await features.ensureLoaded();
    } catch {
      return { name: 'chat' };
    }
    if (!features.plantExplorerEnabled) {
      return auth.isAdmin ? { name: 'admin' } : { name: 'chat' };
    }
  }
  return true;
});

export default router;
