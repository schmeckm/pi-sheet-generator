/** @deprecated Use seed-xsteps.js seedAll() — kept for backward compatibility */
const { seedUsers, seedPromptConfig } = require('./seed-xsteps');

async function seedAdminAndPrompt() {
  const admin = await seedUsers();
  await seedPromptConfig(admin.id);
  return admin;
}

module.exports = { seedAdminAndPrompt };
