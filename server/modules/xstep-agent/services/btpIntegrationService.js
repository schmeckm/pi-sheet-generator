'use strict';

/**
 * SAP BTP Integration — preparation layer for future connectivity.
 * No actual BTP calls in MVP. This module defines the interface and config
 * so that real integration can be plugged in later.
 */

function getBtpConfig() {
  return {
    enabled: process.env.XSTEP_AGENT_BTP_ENABLED === 'true',
    baseUrl: process.env.XSTEP_AGENT_BTP_URL || '',
    clientId: process.env.XSTEP_AGENT_BTP_CLIENT_ID || '',
    tokenUrl: process.env.XSTEP_AGENT_BTP_TOKEN_URL || '',
    apiPath: process.env.XSTEP_AGENT_BTP_API_PATH || '/sap/opu/odata/sap/API_PROCESS_ORDER_2',
  };
}

function isBtpConfigured() {
  const cfg = getBtpConfig();
  return cfg.enabled && !!cfg.baseUrl && !!cfg.clientId;
}

/**
 * Placeholder: fetch master recipe from SAP BTP.
 * @returns {Promise<null>} Always null in MVP.
 */
async function fetchRecipeFromBtp(_recipeId) {
  if (!isBtpConfigured()) return null;
  // Future: OAuth2 client_credentials flow → OData call
  // const token = await getOAuthToken(cfg.tokenUrl, cfg.clientId, cfg.clientSecret);
  // const res = await fetch(`${cfg.baseUrl}${cfg.apiPath}/MasterRecipe('${recipeId}')`, { headers: { Authorization: `Bearer ${token}` } });
  return null;
}

/**
 * Placeholder: push approved template to SAP BTP.
 * @returns {Promise<null>} Always null in MVP (no write-back).
 */
async function pushTemplateToBtp(_template) {
  if (!isBtpConfigured()) return null;
  // Future: POST to SAP API with approved template
  // Requires human approval + audit trail before calling
  return null;
}

function getBtpStatus() {
  const cfg = getBtpConfig();
  return {
    configured: isBtpConfigured(),
    enabled: cfg.enabled,
    hasUrl: !!cfg.baseUrl,
    hasClientId: !!cfg.clientId,
    note: 'SAP BTP integration is prepared but not active in MVP. No write-back occurs.',
  };
}

module.exports = {
  getBtpConfig,
  isBtpConfigured,
  fetchRecipeFromBtp,
  pushTemplateToBtp,
  getBtpStatus,
};
