import { spawn } from 'child_process';
import { createServer } from 'http';
import path from 'path';

const PORT = 3000;
const HEALTH_PORT = 3001;
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Start Next.js dev server
const nextProcess = spawn('node', ['node_modules/.bin/next', 'dev', '-p', String(PORT)], {
  cwd: PROJECT_ROOT,
  stdio: 'inherit',
  detached: true,
  env: { ...process.env },
});

console.log(`Next.js dev server started with PID: ${nextProcess.pid}`);

// Start Email Poller Service
const emailPollerPath = path.join(PROJECT_ROOT, 'mini-services', 'email-poller');
const emailPollerProcess = spawn('bun', ['run', 'dev'], {
  cwd: emailPollerPath,
  stdio: 'inherit',
  detached: true,
  env: { ...process.env },
});

console.log(`Email Poller Service started with PID: ${emailPollerProcess.pid}`);

// Health check server
const healthServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      nextPid: nextProcess.pid,
      emailPollerPid: emailPollerProcess.pid,
      port: PORT,
      services: {
        nextjs: 'running',
        emailPoller: 'running'
      }
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

healthServer.listen(HEALTH_PORT, () => {
  console.log(`Health check server running on port ${HEALTH_PORT}`);
});

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  nextProcess.kill('SIGTERM');
  emailPollerProcess.kill('SIGTERM');
  healthServer.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  nextProcess.kill('SIGINT');
  emailPollerProcess.kill('SIGINT');
  healthServer.close();
  process.exit(0);
});

// Keep process alive
process.stdin.resume();
