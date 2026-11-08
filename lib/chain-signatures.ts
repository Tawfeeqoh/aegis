import {PublicKey} from 'near-api-js';
import {publicKeyToAddress} from 'viem/accounts';
import {keccak256, parseTransaction, recoverTransactionAddress, serializeTransaction, type Hex} from 'viem';
import {AegisError} from './engine.ts';
export const MPC_CONTRACT='v1.signer-prod.testnet';
export const MPC_PATH='aegis/sepolia/v1';
export const CHAIN_ID=11155111;
export function foreignAddress(publicKey:string) {
 const pk=PublicKey.fromString(publicKey);if(!publicKey.startsWith('secp256k1:')||pk.data.length!==64)throw new AegisError('public_key','Unexpected MPC public key.',502);
 return publicKeyToAddress(`0x04${Buffer.from(pk.data).toString('hex')}`);
}
export function checkedTransaction(row:any) {
 if(!row||typeof row.unsigned_tx!=='string'||!/^[a-f0-9]{20,600}$/.test(row.unsigned_tx))throw new AegisError('transaction','Invalid contract transaction.',502);
 const unsigned=`0x${row.unsigned_tx}` as Hex,tx=parseTransaction(unsigned);
 if(tx.type!=='eip1559'||tx.chainId!==CHAIN_ID||tx.to?.toLowerCase()!==row.recipient||tx.value!==BigInt(row.value)||tx.gas!==21000n||tx.maxFeePerGas!==BigInt(row.max_fee_per_gas)||tx.maxPriorityFeePerGas!==BigInt(row.priority_fee)||tx.nonce!==row.nonce||!Number.isSafeInteger(row.nonce)||(tx.data&&tx.data!=='0x')||(tx.accessList&&tx.accessList.length)||BigInt(row.cost_cap)!==tx.value+21000n*tx.maxFeePerGas)throw new AegisError('transaction','The signed transaction differs from the approved native Sepolia transfer.',502);
 const digest=keccak256(unsigned);if(!Array.isArray(row.payload)||Buffer.from(row.payload).toString('hex')!==digest.slice(2))throw new AegisError('payload','The MPC payload differs from the transaction.',502);
 return {tx,unsigned,digest};
}
export async function signedTransaction(row:any,publicKey:string) {
 const {tx}=checkedTransaction(row);if(row.status!=='Signed'||typeof row.signature!=='string')throw new AegisError('signature','MPC signing is not complete.',409);
 let sig:any;try{sig=JSON.parse(row.signature);sig=sig.Secp256k1??sig;}catch{throw new AegisError('signature','Unreadable MPC signature.',502);}
 const point=sig.big_r?.affine_point,s=sig.s?.scalar,yParity=sig.recovery_id;
 if(typeof point!=='string'||!/^0[23][0-9a-fA-F]{64}$/.test(point)||typeof s!=='string'||!/^[0-9a-fA-F]{64}$/.test(s)||![0,1].includes(yParity))throw new AegisError('signature','Unexpected MPC signature encoding.',502);
 const raw=serializeTransaction({...tx,type:'eip1559'}, {r:`0x${point.slice(2)}`,s:`0x${s}`,yParity});
 const sender=await recoverTransactionAddress({serializedTransaction:raw});const expected=foreignAddress(publicKey);
 if(sender.toLowerCase()!==expected.toLowerCase())throw new AegisError('signature','MPC signature verification failed.',502);
 return {raw,hash:keccak256(raw),sender};
}
