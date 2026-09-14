import {configReady,configured,json} from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(){return json({storage:configReady(),streaming:configured(),hosting:!!process.env.CASTORA_HOST_EMAILS})}
