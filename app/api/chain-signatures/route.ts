import {AegisError, audit} from '@/lib/engine';
import {workspaceId, read, mutate} from '@/lib/store';
import {nearRead, evmRpc} from '@/lib/settlement';
import {MPC_CONTRACT,MPC_PATH,foreignAddress,signedTransaction} from '@/lib/chain-signatures';
export const dynamic='force-dynamic';export const maxDuration=60;
const json=(x:unknown,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){try {
 const {state}=await read(await workspaceId()),contract=state.chainContract??process.env.AEGIS_CHAIN_CONTRACT;
 if(!contract)return json({configured:false,signer:MPC_CONTRACT,path:MPC_PATH,network:'Sepolia'});
 const [config,requests,key]=await Promise.all([nearRead(contract,'get_config'),nearRead(contract,'list_requests'),nearRead(MPC_CONTRACT,'derived_public_key',{path:MPC_PATH,predecessor:contract,key_version:0})]);
 if(config.value.signer!==MPC_CONTRACT||config.value.path!==MPC_PATH||config.value.chain_id!==11155111)throw new AegisError('config','The configured contract has an unexpected signing domain.',502);
 const address=foreignAddress(key.value);const [balance,nonce]=await Promise.all([evmRpc('sepolia','eth_getBalance',[address,'latest']),evmRpc('sepolia','eth_getTransactionCount',[address,'pending'])]);
 return json({configured:true,contract,config:config.value,requests:requests.value,publicKey:key.value,address,balance:BigInt(balance).toString(),nonce:Number(BigInt(nonce)),blockHeight:config.blockHeight});
}catch(e){return json({error:e instanceof AegisError?e.code:'network',message:e instanceof AegisError?e.message:'Chain Signatures could not be read.'},502);}}
export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==req.headers.get('host'))throw new AegisError('origin','Use your own workspace.',403);
 const text=await req.text();if(text.length>1000)throw new AegisError('size','Request too large.',413);const data=JSON.parse(text),id=await workspaceId();
 if(data.action==='configure'){if(typeof data.contract!=='string'||!/^[a-z0-9][a-z0-9._-]{1,62}[a-z0-9]$/.test(data.contract)||!data.contract.endsWith('.testnet'))throw new AegisError('contract','Use a testnet contract account.');return json(await mutate(id,async s=>{s.chainContract=data.contract;await audit(s,'owner','chain.configured',`Chain Signatures contract selected: ${data.contract}`);return null;}));}
 const {state}=await read(id),contract=state.chainContract??process.env.AEGIS_CHAIN_CONTRACT;if(!contract)throw new AegisError('contract','Configure a cross-chain contract first.');
 const [{value:row},{value:key}]=await Promise.all([nearRead(contract,'get_request',{id:data.id}),nearRead(MPC_CONTRACT,'derived_public_key',{path:MPC_PATH,predecessor:contract,key_version:0})]);
 const signed=await signedTransaction(row,key);
 if(data.action==='broadcast'){
  if(state.paused)throw new AegisError('paused','The workspace is paused.',409);
  const hash=await evmRpc('sepolia','eth_sendRawTransaction',[signed.raw]);if(hash!==signed.hash)throw new AegisError('transaction','Unexpected destination transaction hash.',502);
  await mutate(id,async s=>{await audit(s,'owner','chain.broadcast','Verified MPC signature broadcast to Sepolia. Receipt is not yet final.',Date.now(),row.id);return null;});return json({hash,sender:signed.sender,status:'broadcast'});
 }
 if(data.action==='receipt'){
  const receipt=await evmRpc('sepolia','eth_getTransactionReceipt',[signed.hash]);if(!receipt)return json({hash:signed.hash,status:'pending'});
  const head=BigInt(await evmRpc('sepolia','eth_blockNumber',[]));const confirmations=Number(head-BigInt(receipt.blockNumber)+1n);
  return json({hash:signed.hash,status:receipt.status==='0x1'?(confirmations>=12?'confirmed':'confirming'):'failed',confirmations,sender:signed.sender});
 }
 throw new AegisError('action','Unknown chain action.');
}catch(e){return json({error:e instanceof AegisError?e.code:'network',message:e instanceof AegisError?e.message:'The cross-chain action could not be completed.'},e instanceof AegisError?e.status:502);}}
