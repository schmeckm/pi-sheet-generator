const { sequelize, ensurePgVectorExtension } = require('../config/database');
const defineUser = require('./User');
const defineXStep = require('./XStep');
const definePISheet = require('./PISheet');
const definePISheetStep = require('./PISheetStep');
const definePromptConfig = require('./PromptConfig');
const defineAuditLog = require('./AuditLog');
const defineKnowledgeDocument = require('./KnowledgeDocument');
const defineDocumentChunk = require('./DocumentChunk');
const defineEquipmentConfig = require('./EquipmentConfig');
const defineWeighingRecord = require('./WeighingRecord');
const defineSystemSetting = require('./SystemSetting');
const defineProcessGraphEdge = require('./ProcessGraphEdge');
const defineGraphEdgeSuggestion = require('./GraphEdgeSuggestion');
const definePromptConfigVersion = require('./PromptConfigVersion');
const defineLlmUsageDaily = require('./LlmUsageDaily');

const User = defineUser(sequelize);
const XStep = defineXStep(sequelize);
const PISheet = definePISheet(sequelize);
const PISheetStep = definePISheetStep(sequelize);
const PromptConfig = definePromptConfig(sequelize);
const AuditLog = defineAuditLog(sequelize);
const KnowledgeDocument = defineKnowledgeDocument(sequelize);
const DocumentChunk = defineDocumentChunk(sequelize);
const EquipmentConfig = defineEquipmentConfig(sequelize);
const WeighingRecord = defineWeighingRecord(sequelize);
const SystemSetting = defineSystemSetting(sequelize);
const ProcessGraphEdge = defineProcessGraphEdge(sequelize);
const GraphEdgeSuggestion = defineGraphEdgeSuggestion(sequelize);
const PromptConfigVersion = definePromptConfigVersion(sequelize);
const LlmUsageDaily = defineLlmUsageDaily(sequelize);

// User associations
User.hasMany(XStep, { foreignKey: 'created_by', as: 'xsteps' });
XStep.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

User.hasMany(PISheet, { foreignKey: 'created_by', as: 'piSheets' });
PISheet.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(PISheet, { foreignKey: 'submitted_by', as: 'submittedPiSheets' });
PISheet.belongsTo(User, { foreignKey: 'submitted_by', as: 'submitter' });
User.hasMany(PISheet, { foreignKey: 'approved_by', as: 'approvedPiSheets' });
PISheet.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });

User.hasMany(PromptConfig, { foreignKey: 'created_by', as: 'promptConfigs' });
PromptConfig.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

PromptConfig.hasMany(PromptConfigVersion, {
  foreignKey: 'prompt_config_id',
  as: 'versions',
  onDelete: 'CASCADE',
});
PromptConfigVersion.belongsTo(PromptConfig, { foreignKey: 'prompt_config_id', as: 'promptConfig' });
User.hasMany(PromptConfigVersion, { foreignKey: 'created_by', as: 'promptVersions' });
PromptConfigVersion.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

User.hasMany(LlmUsageDaily, { foreignKey: 'user_id', as: 'llmUsageDaily' });
LlmUsageDaily.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// PI Sheet associations
PISheet.hasMany(PISheetStep, { foreignKey: 'pi_sheet_id', as: 'steps', onDelete: 'CASCADE' });
PISheetStep.belongsTo(PISheet, { foreignKey: 'pi_sheet_id', as: 'piSheet' });

// Knowledge base associations
User.hasMany(KnowledgeDocument, { foreignKey: 'uploaded_by', as: 'knowledgeDocuments' });
KnowledgeDocument.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

KnowledgeDocument.hasMany(DocumentChunk, {
  foreignKey: 'document_id',
  as: 'chunks',
  onDelete: 'CASCADE',
});
DocumentChunk.belongsTo(KnowledgeDocument, { foreignKey: 'document_id', as: 'document' });

PISheet.hasMany(WeighingRecord, { foreignKey: 'pi_sheet_id', as: 'weighingRecords' });
WeighingRecord.belongsTo(PISheet, { foreignKey: 'pi_sheet_id', as: 'piSheet' });

PISheetStep.hasMany(WeighingRecord, { foreignKey: 'pi_sheet_step_id', as: 'weighingRecords' });
WeighingRecord.belongsTo(PISheetStep, { foreignKey: 'pi_sheet_step_id', as: 'piSheetStep' });

EquipmentConfig.hasMany(WeighingRecord, {
  foreignKey: 'equipment_id',
  sourceKey: 'equipment_id',
  as: 'weighingRecords',
});
WeighingRecord.belongsTo(EquipmentConfig, {
  foreignKey: 'equipment_id',
  targetKey: 'equipment_id',
  as: 'equipment',
});

User.hasMany(WeighingRecord, { foreignKey: 'weighed_by', as: 'weighings' });
WeighingRecord.belongsTo(User, { foreignKey: 'weighed_by', as: 'weighedBy' });

User.hasMany(WeighingRecord, { foreignKey: 'verified_by', as: 'verifiedWeighings' });
WeighingRecord.belongsTo(User, { foreignKey: 'verified_by', as: 'verifiedBy' });

User.hasMany(ProcessGraphEdge, { foreignKey: 'created_by', as: 'graphEdges' });
ProcessGraphEdge.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

KnowledgeDocument.hasMany(GraphEdgeSuggestion, {
  foreignKey: 'document_id',
  as: 'graphSuggestions',
  onDelete: 'CASCADE',
});
GraphEdgeSuggestion.belongsTo(KnowledgeDocument, { foreignKey: 'document_id', as: 'document' });
DocumentChunk.hasMany(GraphEdgeSuggestion, { foreignKey: 'chunk_id', as: 'graphSuggestions' });
GraphEdgeSuggestion.belongsTo(DocumentChunk, { foreignKey: 'chunk_id', as: 'chunk' });
User.hasMany(GraphEdgeSuggestion, { foreignKey: 'reviewed_by', as: 'reviewedGraphSuggestions' });
GraphEdgeSuggestion.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });

module.exports = {
  sequelize,
  ensurePgVectorExtension,
  User,
  XStep,
  PISheet,
  PISheetStep,
  PromptConfig,
  AuditLog,
  KnowledgeDocument,
  DocumentChunk,
  EquipmentConfig,
  WeighingRecord,
  SystemSetting,
  ProcessGraphEdge,
  GraphEdgeSuggestion,
  PromptConfigVersion,
  LlmUsageDaily,
};
