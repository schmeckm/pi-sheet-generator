/**
 * Applies idempotent schema patches when sequelize-cli db:migrate fails on partial DBs.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const scripts = [
  'apply-lifecycle-migration.js',
  'apply-locale-migration.js',
  'apply-graph-migration.js',
];

const serverRoot = path.join(__dirname, '..');

for (const script of scripts) {
  console.log(`\n>> ${script}`);
  const result = spawnSync('node', [path.join(__dirname, script)], {
    cwd: serverRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.warn(`Warning: ${script} exited with code ${result.status}`);
  }
}

console.log('\nPending migrations check finished.');
