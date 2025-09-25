const { spawn } = require('child_process');
const path = require('path');

console.log('Testing if Riptide can run as subprocess...');

// Test running riptide as subprocess
const riptide = spawn('npx', ['riptide', '--help'], {
  stdio: 'pipe',
  cwd: path.join(__dirname, 'test-service')
});

riptide.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

riptide.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

riptide.on('close', (code) => {
  console.log(`Riptide subprocess exited with code ${code}`);
  if (code === 0) {
    console.log('✅ Riptide can run as subprocess!');
  } else {
    console.log('❌ Riptide failed as subprocess');
  }
});
