'use strict';

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Normalize master recipe JSON (mock or external) to canonical structure.
 * @param {object|string} input
 */
function parseRecipe(input) {
  const recipe = typeof input === 'string' ? JSON.parse(input) : input;
  if (!recipe || typeof recipe !== 'object') {
    throw new Error('Recipe input must be an object');
  }
  if (!recipe.id || !recipe.name) {
    throw new Error('Recipe requires id and name');
  }

  const operations = asArray(recipe.operations).map((op) => ({
    id: op.id,
    name: op.name,
    sequence: Number(op.sequence) || 0,
    phases: asArray(op.phases).map((ph) => ({
      id: ph.id,
      name: ph.name,
      sequence: Number(ph.sequence) || 0,
      requiredXSteps: asArray(ph.requiredXSteps).map(String),
    })),
  }));

  operations.sort((a, b) => a.sequence - b.sequence);
  for (const op of operations) {
    op.phases.sort((a, b) => a.sequence - b.sequence);
  }

  return {
    id: String(recipe.id),
    name: String(recipe.name),
    processArea: recipe.processArea || '',
    packagingType: recipe.packagingType || '',
    version: recipe.version || '1.0',
    operations,
    sourceFormat: 'recipe-json',
  };
}

module.exports = {
  parseRecipe,
};
