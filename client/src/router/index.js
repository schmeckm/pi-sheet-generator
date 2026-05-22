import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

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
    meta: { requiresAuth: true, requiresAdmin: true, layout: 'admin' },
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
    return { name: 'chat' };
  }
  return true;
});

export default router;
