import {riskConfigured,riskModel} from '@/lib/near-ai';
export const dynamic='force-dynamic';
export async function GET(){return Response.json({risk:{configured:riskConfigured(),provider:'NEAR AI Cloud',model:riskModel(),attestationVerified:false},intents:{executionEnabled:process.env.AEGIS_INTENTS_LIVE==='true',network:'mainnet'},chain:{network:'Sepolia',configured:!!process.env.AEGIS_CHAIN_CONTRACT}},{headers:{'Cache-Control':'no-store'}});}
