require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL || 'postgres://pisheet:pisheet_dev@localhost:7003/pisheet';

module.exports = {
  development: {
    url: databaseUrl,
    dialect: 'postgres',
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false,
    },
  },
  production: {
    url: databaseUrl,
    dialect: 'postgres',
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false,
    },
  },
};
