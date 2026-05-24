import { get } from '@/composables/useApi';

export async function fetchDashboardStats() {
  const [health, adminStats, knowledgeStats] = await Promise.all([
    get('/v1/xstep-agent/health').catch(() => null),
    get('/admin/stats').catch(() => null),
    get('/knowledge/stats').catch(() => null),
  ]);

  const pendingReviews = adminStats?.templates?.byStatus?.in_review || 0;
  const drafts = adminStats?.templates?.byStatus?.draft || 0;

  return {
    systemStatus: health?.status === 'ok' ? 'OK' : 'UNAVAILABLE',
    moduleVersion: health?.version || '-',
    llmProvider: health?.llmProvider || '-',
    features: health?.features || {},
    sapBtp: health?.sapBtp || {},
    xstepsIndexed: adminStats?.xsteps?.total || 0,
    xstepsGmpRelevant: adminStats?.xsteps?.gmpRelevant || 0,
    templatesTotal: adminStats?.templates?.total || 0,
    templatesThisWeek: adminStats?.templates?.thisWeek || 0,
    sopChunksIndexed: knowledgeStats?.chunkCount || knowledgeStats?.totalChunks || 0,
    documentsIndexed: knowledgeStats?.documentCount || knowledgeStats?.totalDocuments || 0,
    pendingReviews,
    drafts,
    recentActivity: (adminStats?.recentActivity || []).slice(0, 8).map((a) => ({
      id: a.id,
      time: new Date(a.created_at).toLocaleString(),
      action: a.action,
      user: a.user?.name || a.user?.email || '-',
      status: a.action.includes('approve') ? 'APPROVED'
        : a.action.includes('reject') ? 'REJECTED'
        : a.action.includes('submit') ? 'IN_REVIEW'
        : 'DRAFT_REQUIRES_REVIEW',
    })),
  };
}
