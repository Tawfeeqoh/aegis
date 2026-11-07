import {spawn} from 'node:child_process';
// The managed preview supplies Vite-style flags; translate them for Next.js.
const args=process.argv.slice(2),value=(flag,fallback)=>{const i=args.lastIndexOf(flag);return i<0?fallback:args[i+1]};
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname',value('--host','0.0.0.0'),'--port',value('--port','4173'),'--webpack'],{stdio:'inherit',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>process.exit(code??1));
