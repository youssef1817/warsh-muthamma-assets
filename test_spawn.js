const { spawn } = require('child_process');
const path = require('path');

const psScript = path.resolve(__dirname, 'tools', 'sync_warsh_muthamma_ayahinfo.ps1');
const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript, '-Page', '1'];

const syncProcess = spawn('powershell', args);

syncProcess.stdout.on('data', d => console.log('STDOUT:', d.toString()));
syncProcess.stderr.on('data', d => console.log('STDERR:', d.toString()));
syncProcess.on('error', e => console.log('ERROR:', e));
syncProcess.on('close', c => console.log('CLOSE:', c));
