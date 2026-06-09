const { initDatabase, connectionInfo } = require('./db');

initDatabase()
  .then(() => {
    console.log(`MySQL database ready: ${connectionInfo.database}`);
    console.log(`Host: ${connectionInfo.host}:${connectionInfo.port}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database setup failed:', error.message);
    process.exit(1);
  });
