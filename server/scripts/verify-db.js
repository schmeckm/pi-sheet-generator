require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { sequelize } = require('../config/database');

async function main() {
  const [[users]] = await sequelize.query('SELECT COUNT(*)::int AS c FROM users');
  const [[xsteps]] = await sequelize.query('SELECT COUNT(*)::int AS c FROM xsteps');
  const [[prompts]] = await sequelize.query('SELECT COUNT(*)::int AS c FROM prompt_configs');
  const [cols] = await sequelize.query(
    "SELECT column_name, udt_name FROM information_schema.columns WHERE table_name = 'xsteps' ORDER BY ordinal_position"
  );
  const embedding = cols.find((c) => c.column_name === 'embedding');
  console.log({ users: users.c, xsteps: xsteps.c, prompts: prompts.c, embedding: embedding || 'MISSING' });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
