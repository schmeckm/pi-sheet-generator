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
    path: '/admin/process-graph',
    name: 'admin-process-graph',
    component: () => import('@/views/ProcessGraphView.vue'),
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

const CHUNK_RELOAD_KEY = 'vite:chunk-reload';

function isChunkLoadError(err) {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    /Loading chunk [\w-]+ failed/.test(msg)
  );
}

// After a deploy, cached entry bundles may reference removed lazy chunks — reload once.
router.onError((err, to) => {
  if (!isChunkLoadError(err)) throw err;
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    throw err;
  }
  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  window.location.assign(to.fullPath);
});

router.isReady().then(() => {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
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
  return true;
});

export default router;
