use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise};
use near_sdk::collections::LookupMap;
use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, json};
#[cfg(test)]
const DAY: u64 = 86_400_000_000_000;
const CHAIN: u128 = 11_155_111;
const PATH: &str = "aegis/sepolia/v1";
const SIGNER: &str = "v1.signer-prod.testnet";
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Agent {active: bool, daily: U128}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Policy {version: u64, daily: U128, per_payment: U128, max_fee_per_gas: U128, recipients: Vec<String>, ttl_seconds: u64}
#[near(serializers=[borsh,json])]
#[derive(Clone,PartialEq,Debug)]
pub enum Status {Approval, Signing, Signed, SigningFailed, Rejected, Expired, Blocked}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Request {pub id: String, pub agent: AccountId, pub recipient: String, pub value: U128, pub max_fee_per_gas: U128, pub priority_fee: U128, pub cost_cap: U128, pub nonce: u64, pub reference: String, pub fingerprint: String, pub unsigned_tx: String, pub payload: Vec<u8>, pub policy_version: u64, pub created: u64, pub expires: u64, pub status: Status, pub reason: String, pub signature: Option<String>}
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Crosschain {owner: AccountId, policy: Policy, paused: bool, next_nonce: u64, agents: LookupMap<AccountId,Agent>, requests: LookupMap<String,Request>, ids: Vec<String>}
#[near]
impl Crosschain {
 #[init]
 pub fn new(owner: AccountId, daily: U128, per_payment: U128, max_fee_per_gas: U128, recipients: Vec<String>, next_nonce: u64) -> Self {
  require!(env::predecessor_account_id()==env::current_account_id(),"Initialize through the contract account");
  require!(env::current_account_id().as_str().ends_with(".testnet"),"Testnet only");
  let policy=Policy {version:1,daily,per_payment,max_fee_per_gas,recipients:recipients.iter().map(|x|address(x)).collect(),ttl_seconds:1800}; Self::validate(&policy);
  Self {owner,policy,paused:false,next_nonce,agents:LookupMap::new(b"a"),requests:LookupMap::new(b"r"),ids:vec![]}
 }
 pub fn get_config(&self)->serde_json::Value {json!({"owner":self.owner,"policy":self.policy,"paused":self.paused,"chain_id":CHAIN as u64,"path":PATH,"signer":SIGNER,"next_nonce":self.next_nonce,"settlement":"Signatures only. Destination receipts must be verified separately."})}
 pub fn list_requests(&self)->Vec<Request> {self.ids.iter().filter_map(|id|self.requests.get(id)).collect()}
 pub fn get_request(&self,id:String)->Option<Request> {self.requests.get(&id)}
 pub fn register_agent(&mut self,account:AccountId,daily:U128) {self.owner_only();require!(daily.0>0,"Positive budget required");self.agents.insert(&account,&Agent {active:true,daily});}
 pub fn set_agent_active(&mut self,account:AccountId,active:bool) {self.owner_only();let mut a=self.agents.get(&account).expect("Unknown agent");a.active=active;self.agents.insert(&account,&a);}
 pub fn set_paused(&mut self,paused:bool) {self.owner_only();self.paused=paused;}
 pub fn update_policy(&mut self,daily:U128,per_payment:U128,max_fee_per_gas:U128,recipients:Vec<String>) {self.owner_only();let p=Policy {version:self.policy.version+1,daily,per_payment,max_fee_per_gas,recipients:recipients.iter().map(|x|address(x)).collect(),ttl_seconds:1800};Self::validate(&p);self.policy=p;for id in &self.ids {let mut r=self.requests.get(id).unwrap();if r.status==Status::Approval {r.status=Status::Rejected;r.reason="Policy changed; approval invalidated".into();self.requests.insert(id,&r);}}}
 pub fn request_evm(&mut self,recipient:String,value:U128,max_fee_per_gas:U128,priority_fee:U128,nonce:u64,reference:String)->Request {
  let agent=env::predecessor_account_id();let a=self.agents.get(&agent).expect("Agent not registered");let recipient=address(&recipient);
  require!(value.0>0&&max_fee_per_gas.0>0&&priority_fee.0<=max_fee_per_gas.0,"Invalid transaction amounts");require!(!reference.is_empty()&&reference.len()<=100&&reference.bytes().all(|b|b.is_ascii_alphanumeric()||b"._:-".contains(&b)),"Invalid reference");
  let id=format!("{}:{}",agent,reference);let tx=transaction(nonce,&recipient,value.0,max_fee_per_gas.0,priority_fee.0);let payload=env::keccak256(&tx);let fingerprint=hex(&env::sha256(&serde_json::to_vec(&json!({"agent":agent,"reference":reference,"tx":hex(&tx)})).unwrap()));
  if let Some(prior)=self.requests.get(&id) {require!(prior.fingerprint==fingerprint,"REFERENCE_CONFLICT");return prior;}
  require!(self.ids.len()<100,"Request capacity reached");let now=env::block_timestamp();let cost=value.0.checked_add(max_fee_per_gas.0.checked_mul(21000).expect("Fee overflow")).expect("Cost overflow");
  let reason=if self.paused {"Treasury paused"}else if !a.active {"Agent revoked"}else if !self.policy.recipients.contains(&recipient) {"Recipient not approved"}else if max_fee_per_gas.0>self.policy.max_fee_per_gas.0 {"Fee cap exceeded"}else if cost>self.policy.per_payment.0 {"Per-payment cap exceeded, including gas"}else if self.usage(now,None).checked_add(cost).unwrap()>self.policy.daily.0 {"Shared budget exceeded"}else if self.usage(now,Some(&agent)).checked_add(cost).unwrap()>a.daily.0 {"Agent budget exceeded"}else if nonce<self.next_nonce {"Nonce already allocated"}else {""};
  let r=Request {id:id.clone(),agent,recipient,value,max_fee_per_gas,priority_fee,cost_cap:U128(cost),nonce,reference,fingerprint,unsigned_tx:hex(&tx),payload,policy_version:self.policy.version,created:now,expires:now+self.policy.ttl_seconds*1_000_000_000,status:if reason.is_empty(){Status::Approval}else{Status::Blocked},reason:if reason.is_empty(){"Exact owner approval required before MPC signing".into()}else{reason.into()},signature:None};self.ids.push(id.clone());self.requests.insert(&id,&r);self.event("request_evaluated",&id);r
 }
 pub fn approve_evm(&mut self,id:String,fingerprint:String)->Promise {
  self.owner_only();let mut r=self.requests.get(&id).expect("Unknown request");require!(r.fingerprint==fingerprint,"APPROVAL_MISMATCH");require!(!self.paused,"Treasury paused");require!(self.agents.get(&r.agent).is_some_and(|a|a.active&&self.usage(env::block_timestamp(),Some(&r.agent))<=a.daily.0),"Agent revoked or budget changed");
  if r.status==Status::SigningFailed {require!(r.policy_version==self.policy.version,"Stale policy");} else {require!(r.status==Status::Approval,"Not awaiting approval");require!(env::block_timestamp()<r.expires&&r.policy_version==self.policy.version,"Expired or stale request");require!(r.nonce==self.next_nonce,"Approve in nonce order");require!(self.usage(env::block_timestamp(),None)<=self.policy.daily.0,"Budget changed");self.next_nonce=self.next_nonce.checked_add(1).expect("Nonce overflow");}
  r.status=Status::Signing;r.reason="MPC signature requested; no destination settlement claimed".into();self.requests.insert(&id,&r);self.event("signature_requested",&id);
  Promise::new(SIGNER.parse().unwrap()).function_call("sign",serde_json::to_vec(&json!({"request":{"payload":r.payload,"path":PATH,"key_version":0}})).unwrap(),NearToken::from_yoctonear(1),Gas::from_tgas(250)).then(Promise::new(env::current_account_id()).function_call("on_signature",serde_json::to_vec(&json!({"id":id})).unwrap(),NearToken::from_yoctonear(0),Gas::from_tgas(20)))
 }
 pub fn reject(&mut self,id:String) {self.owner_only();let mut r=self.requests.get(&id).expect("Unknown request");require!(r.status==Status::Approval,"Signed authority cannot be revoked");r.status=Status::Rejected;r.reason="Owner rejected request".into();self.requests.insert(&id,&r);}
 #[private]
 pub fn on_signature(&mut self,id:String)->Request {let mut r=self.requests.get(&id).expect("Unknown request");require!(r.status==Status::Signing,"Already resolved");match env::promise_result_checked(0,4096) {Ok(bytes)=>{if let Ok(v)=serde_json::from_slice::<serde_json::Value>(&bytes) {r.signature=Some(v.to_string());r.status=Status::Signed;r.reason="MPC signature returned. Destination settlement unverified.".into();}else{r.status=Status::SigningFailed;r.reason="Unreadable MPC result; budget remains reserved".into();}},Err(_)=>{r.status=Status::SigningFailed;r.reason="MPC request failed; retry this exact payload. Budget remains reserved.".into();}}self.requests.insert(&id,&r);self.event("signature_resolved",&id);r}
}
impl Crosschain {
 fn owner_only(&self) {require!(env::predecessor_account_id()==self.owner,"Owner required");}
 fn validate(p:&Policy) {require!(p.per_payment.0>0&&p.per_payment.0<=p.daily.0,"Invalid budgets");require!(p.max_fee_per_gas.0>0&&p.max_fee_per_gas.0<=100_000_000_000,"Max fee must be within 100 gwei");require!(!p.recipients.is_empty()&&p.recipients.len()<=30,"Invalid recipients");}
 fn usage(&self,now:u64,agent:Option<&AccountId>)->u128 {self.ids.iter().filter_map(|id|self.requests.get(id)).filter(|r|agent.is_none_or(|a|r.agent==*a)).filter(|r|match r.status {Status::Approval=>r.expires>now,Status::Signing|Status::Signed|Status::SigningFailed=>true,_=>false}).map(|r|r.cost_cap.0).sum()}
 fn event(&self,event:&str,id:&str) {env::log_str(&format!("EVENT_JSON:{}",json!({"standard":"aegis","version":"1.0.0","event":event,"data":[{"id":id,"chain_id":CHAIN as u64,"policy_version":self.policy.version}]})));}
}
fn address(s:&str)->String {require!(s.len()==42&&s.starts_with("0x")&&s[2..].bytes().all(|x|x.is_ascii_hexdigit()),"Invalid EVM address");require!(s[2..].bytes().any(|x|x!=b'0'),"Zero address refused");s.to_lowercase()}
fn hex(b:&[u8])->String {b.iter().map(|x|format!("{x:02x}")).collect()}
fn unhex(s:&str)->Vec<u8> {(0..s.len()).step_by(2).map(|i|u8::from_str_radix(&s[i..i+2],16).unwrap()).collect()}
fn rlp(bytes:&[u8],list:bool)->Vec<u8> {let base=if list{0xc0}else{0x80};if !list&&bytes.len()==1&&bytes[0]<0x80{return bytes.to_vec();}let mut out=if bytes.len()<56 {vec![base+bytes.len() as u8]}else {let l=(bytes.len()as u64).to_be_bytes();let l=&l[l.iter().position(|x|*x!=0).unwrap()..];let mut v=vec![base+55+l.len()as u8];v.extend(l);v};out.extend(bytes);out}
fn number(n:u128)->Vec<u8> {let b=n.to_be_bytes();rlp(&b[b.iter().position(|x|*x!=0).unwrap_or(16)..],false)}
fn transaction(nonce:u64,to:&str,value:u128,max_fee:u128,priority:u128)->Vec<u8> {let fields=[number(CHAIN),number(nonce as u128),number(priority),number(max_fee),number(21000),rlp(&unhex(&to[2..]),false),number(value),rlp(&[],false),rlp(&[],true)].concat();[vec![2],rlp(&fields,true)].concat()}
#[cfg(test)]
mod tests {
 use super::*;use near_sdk::{testing_env,test_utils::VMContextBuilder};
 fn ctx(who:&str,t:u64) {let mut b=VMContextBuilder::new();b.current_account_id("cross.testnet".parse().unwrap()).predecessor_account_id(who.parse().unwrap()).block_timestamp(t).account_balance(NearToken::from_near(100)).prepaid_gas(Gas::from_tgas(300));testing_env!(b.build());}
 fn fixture()->Crosschain {ctx("cross.testnet",DAY*2);let mut c=Crosschain::new("owner.testnet".parse().unwrap(),U128(10_000_000),U128(5_000_000),U128(100),vec!["0x1111111111111111111111111111111111111111".into()],0);ctx("owner.testnet",DAY*2);c.register_agent("bot.testnet".parse().unwrap(),U128(10_000_000));c}
 fn req(c:&mut Crosschain,to:&str,n:u128,reference:&str)->Request {ctx("bot.testnet",DAY*2);c.request_evm(to.into(),U128(n),U128(100),U128(1),0,reference.into())}
 const TO:&str="0x1111111111111111111111111111111111111111";
 #[test]fn builds_chain_bound_native_transfer() {let tx=transaction(0,TO,1,100,1);assert_eq!(hex(&tx),"02e283aa36a78001648252089411111111111111111111111111111111111111110180c0");}
 #[test]fn unknown_recipient_blocked() {let mut c=fixture();assert_eq!(req(&mut c,"0x2222222222222222222222222222222222222222",1,"a").status,Status::Blocked);}
 #[test]fn cap_includes_maximum_gas() {let mut c=fixture();assert_eq!(req(&mut c,TO,3_000_000,"a").status,Status::Blocked);}
 #[test]fn retries_preserve_exact_payload() {let mut c=fixture();let a=req(&mut c,TO,1,"a");let b=req(&mut c,TO,1,"a");assert_eq!(a.fingerprint,b.fingerprint);assert_eq!(c.ids.len(),1);}
 #[test]#[should_panic(expected="REFERENCE_CONFLICT")]fn mutation_refused() {let mut c=fixture();req(&mut c,TO,1,"a");req(&mut c,TO,2,"a");}
 #[test]#[should_panic(expected="Owner required")]fn agent_cannot_sign() {let mut c=fixture();let r=req(&mut c,TO,1,"a");let _=c.approve_evm(r.id,r.fingerprint);}
 #[test]#[should_panic(expected="APPROVAL_MISMATCH")]fn changed_approval_refused() {let mut c=fixture();let r=req(&mut c,TO,1,"a");ctx("owner.testnet",DAY*2);let _=c.approve_evm(r.id,"altered".into());}
 #[test]fn approval_allocates_nonce_once() {let mut c=fixture();let r=req(&mut c,TO,1,"a");ctx("owner.testnet",DAY*2);let _=c.approve_evm(r.id.clone(),r.fingerprint);assert_eq!(c.next_nonce,1);assert_eq!(c.get_request(r.id).unwrap().status,Status::Signing);}
 #[test]fn pause_blocks_new_authority() {let mut c=fixture();c.set_paused(true);assert_eq!(req(&mut c,TO,1,"a").status,Status::Blocked);}
}
