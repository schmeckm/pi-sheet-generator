'use strict';

const schema = require('../schemas/templateOutput.schema.json');

function validateType(value, typeDef) {
  if (typeDef.enum && !typeDef.enum.includes(value)) return false;
  if (typeDef.type === 'string' && typeof value !== 'string') return false;
  if (typeDef.type === 'number' && typeof value !== 'number') return false;
  if (typeDef.type === 'boolean' && typeof value !== 'boolean') return false;
  if (typeDef.type === 'array' && !Array.isArray(value)) return false;
  if (typeDef.type === 'object' && (value == null || typeof value !== 'object' || Array.isArray(value))) {
    return false;
  }
  return true;
}

function validateAgainstSchema(obj, def, path = '') {
  const errors = [];
  if (def.type === 'object') {
    for (const key of def.required || []) {
      if (obj[key] === undefined) {
        errors.push(`${path || 'root'} missing required property "${key}"`);
      }
    }
    for (const [key, propDef] of Object.entries(def.properties || {})) {
      if (obj[key] === undefined) continue;
      if (!validateType(obj[key], propDef)) {
        errors.push(`${path}.${key} has invalid type`);
      }
      if (propDef.type === 'array' && propDef.items) {
        obj[key].forEach((item, index) => {
          errors.push(...validateAgainstSchema(item, propDef.items, `${path}.${key}[${index}]`));
        });
      }
    }
  }
  return errors;
}

function validateTemplateShape(template) {
  return validateAgainstSchema(template, schema);
}

module.exports = {
  validateTemplateShape,
};
