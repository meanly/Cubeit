// Starts the Expo web dev server on the port assigned by the preview harness (PORT env).
import { spawn } from 'node:child_process';

const port = process.env.PORT ?? '8081';
const child = spawn('npx', ['expo', 'start', '--web', '--port', port], {
  stdio: 'inherit',
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
