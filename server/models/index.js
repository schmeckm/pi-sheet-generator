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
};
