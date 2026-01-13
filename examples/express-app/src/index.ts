import { loadConfig } from './config.js';

async function main() {
  console.log('Loading configuration...\n');

  // Load typed configuration
  const config = await loadConfig();

  // Access configuration with full type safety
  const serverHost = config.get('server.host');
  const serverPort = config.get('server.port');
  const dbUrl = config.get('database.url');
  const logLevel = config.get('logging.level');

  console.log('='.repeat(50));
  console.log('Application Configuration');
  console.log('='.repeat(50));
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  console.log('');

  // Server settings
  console.log('Server:');
  console.log(`  Host: ${serverHost}`);
  console.log(`  Port: ${serverPort}`);
  console.log('');

  // Database settings
  console.log('Database:');
  console.log(`  URL: ${dbUrl}`);
  console.log(`  Pool Size: ${config.get('database.poolSize')}`);
  console.log(`  SSL: ${config.get('database.ssl')}`);
  console.log('');

  // Redis settings
  console.log('Redis:');
  console.log(`  Host: ${config.get('redis.host')}`);
  console.log(`  Port: ${config.get('redis.port')}`);
  console.log(`  Password: ${config.get('redis.password') ? '******' : '(not set)'}`);
  console.log('');

  // Auth settings (hide sensitive values)
  console.log('Auth:');
  console.log(`  JWT Secret: ${'*'.repeat(config.get('auth.jwtSecret').length)}`);
  console.log(`  JWT Expires: ${config.get('auth.jwtExpiresIn')}`);
  console.log(`  Bcrypt Rounds: ${config.get('auth.bcryptRounds')}`);
  console.log('');

  // Feature flags
  console.log('Features:');
  console.log(`  Cache: ${config.get('features.enableCache') ? 'enabled' : 'disabled'}`);
  console.log(`  Rate Limit: ${config.get('features.enableRateLimit') ? 'enabled' : 'disabled'}`);
  console.log(`  Max Requests/min: ${config.get('features.maxRequestsPerMinute')}`);
  console.log('');

  // Logging
  console.log('Logging:');
  console.log(`  Level: ${logLevel}`);
  console.log(`  Format: ${config.get('logging.format')}`);
  console.log('');

  console.log('='.repeat(50));
  console.log(`Server would start at http://${serverHost}:${serverPort}`);
  console.log('='.repeat(50));

  // Example: Get entire config (readonly)
  // const fullConfig = config.getAll();

  // Example: Check if config exists
  // const hasRedisPassword = config.has('redis.password');

  // Example: Get source of a value
  // const portSource = config.getSource('server.port');
}

main().catch(console.error);
