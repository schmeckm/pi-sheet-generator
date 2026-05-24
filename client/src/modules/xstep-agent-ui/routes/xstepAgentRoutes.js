const LAYOUT = 'xstep-agent';
const META = { requiresAuth: true, requiresAdmin: true, layout: LAYOUT };

export const xstepAgentRoutes = [
  {
    path: '/xstep-agent',
    redirect: '/xstep-agent/dashboard',
  },
  {
    path: '/xstep-agent/dashboard',
    name: 'xstep-dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { ...META },
  },
  {
    path: '/xstep-agent/materials',
    name: 'xstep-materials',
    component: () => import('../views/MaterialExplorerView.vue'),
    meta: { ...META },
  },
  {
    path: '/xstep-agent/recipes',
    name: 'xstep-recipes',
    component: () => import('../views/RecipeExplorerView.vue'),
    meta: { ...META },
  },
  {
    path: '/xstep-agent/xsteps',
    name: 'xstep-browser',
    component: () => import('../views/XStepBrowserView.vue'),
    meta: { ...META },
  },
  {
    path: '/xstep-agent/sops',
    name: 'xstep-sops',
    component: () => import('../views/SopBrowserView.vue'),
    meta: { ...META },
  },
  {
    path: '/xstep-agent/import',
    name: 'xstep-import',
    component: () => import('../views/ImportView.vue'),
    meta: { ...META },
  },
  {
    path: '/xstep-agent/composer',
    name: 'xstep-composer',
    component: () => import('../views/TemplateComposerView.vue'),
    meta: { ...META },
  },
  {
    path: '/xstep-agent/review',
    name: 'xstep-review',
    component: () => import('../views/ReviewBoardView.vue'),
    meta: { ...META },
  },
  {
    path: '/xstep-agent/retrieval-debugger',
    name: 'xstep-retrieval-debugger',
    component: () => import('../views/RetrievalDebuggerView.vue'),
    meta: { ...META },
  },
  {
    path: '/xstep-agent/knowledge-graph',
    name: 'xstep-knowledge-graph',
    component: () => import('../views/KnowledgeGraphView.vue'),
    meta: { ...META },
  },
  {
    path: '/xstep-agent/audit',
    name: 'xstep-audit',
    component: () => import('../views/AuditTrailView.vue'),
    meta: { ...META },
  },
  {
    path: '/xstep-agent/settings',
    name: 'xstep-settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { ...META },
  },
  {
    path: '/xstep-agent/help',
    name: 'xstep-help',
    component: () => import('../views/HelpView.vue'),
    meta: { ...META },
  },
];
