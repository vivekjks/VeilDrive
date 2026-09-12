import { spawnSync } from 'node:child_process';

const name = 'veildrive-proof-server-81';
const image = 'midnightntwrk/proof-server:8.1.0';
const docker = process.platform === 'win32' ? ['wsl', ['docker']] : ['docker', []];
const run = (...args) => spawnSync(docker[0], [...docker[1], ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const fail = (result, fallback) => {
  const message = result.stderr?.trim() || result.stdout?.trim() || fallback;
  console.error(message);
  process.exit(result.status || 1);
};

const action = process.argv[2] ?? 'start';
const inspect = run('inspect', '--format', '{{.State.Status}}', name);
const exists = inspect.status === 0;

if (action === 'status') {
  if (!exists) {
    console.log('VeilDrive proof server is not created. Run `pnpm proof-server`.');
    process.exit(1);
  }
  console.log(`VeilDrive proof server: ${inspect.stdout.trim()} · http://localhost:6300`);
  process.exit(0);
}

if (action === 'stop') {
  if (!exists) {
    console.log('VeilDrive proof server is already absent.');
    process.exit(0);
  }
  const stopped = run('stop', name);
  if (stopped.status !== 0) fail(stopped, 'Could not stop the VeilDrive proof server.');
  console.log('VeilDrive proof server stopped. Its container is preserved and can be restarted.');
  process.exit(0);
}

if (action !== 'start') {
  console.error(`Unknown action: ${action}. Use start, status, or stop.`);
  process.exit(1);
}

if (exists) {
  if (inspect.stdout.trim() !== 'running') {
    const started = run('start', name);
    if (started.status !== 0) fail(started, 'Could not start the existing proof server.');
  }
} else {
  const created = run(
    'run', '-d', '--name', name,
    '-p', '127.0.0.1:6300:6300',
    '-e', 'RUST_BACKTRACE=full',
    image, 'midnight-proof-server', '-v',
  );
  if (created.status !== 0) fail(created, 'Could not create the VeilDrive proof server.');
}

console.log(`VeilDrive proof server is running on http://localhost:6300 (${image}).`);
