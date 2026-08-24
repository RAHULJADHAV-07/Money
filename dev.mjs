// Runs the API and the Vite dev server together, so `npm run dev` is all you need.
import { spawn } from 'node:child_process';

const procs = [
  { name: 'api', color: '\x1b[36m', args: ['run', 'dev', '--prefix', 'server'] },
  { name: 'web', color: '\x1b[35m', args: ['run', 'dev', '--prefix', 'client'] },
];

const children = procs.map(({ name, color, args }) => {
  const child = spawn('npm', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
  const tag = `${color}[${name}]\x1b[0m `;
  const pipe = (stream) => stream.on('data', (d) => {
    process.stdout.write(String(d).replace(/^/gm, tag).replace(/\n$/, '\n'));
  });
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', (code) => {
    if (code) console.log(`${tag}exited with code ${code}`);
  });
  return child;
});

const stop = () => { children.forEach((c) => c.kill('SIGINT')); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

console.log('\n  API  → http://localhost:4000');
console.log('  App  → http://localhost:5173\n');
