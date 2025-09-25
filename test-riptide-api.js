const riptide = require('./node_modules/@deeep-network/riptide/dist/index.js');
const path = require('path');

console.log('Testing Riptide API as subprocess...');

async function testRiptideAPI() {
  try {
    // Load config and hooks
    const config = await riptide.loadConfig(path.join(__dirname, 'test-service', 'riptide.config.json'));
    console.log('Config loaded:', config);
    
    const hooks = await riptide.loadHooks(path.join(__dirname, 'test-service', 'dist', 'hooks.js'));
    console.log('Hooks loaded:', Object.keys(hooks));
    
    // Test health check
    const logger = riptide.createLogger({ level: 'info' });
    const utils = riptide.createUtilityContext();
    const context = { config, logger, env: process.env, utils };
    
    console.log('Testing health hook...');
    const healthResult = await hooks.health(context);
    console.log('Health result:', healthResult);
    
    console.log('✅ Riptide API works as subprocess!');
    
  } catch (error) {
    console.error('❌ Riptide API failed:', error.message);
  }
}

testRiptideAPI();
