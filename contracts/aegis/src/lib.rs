use near_sdk::{env,near,require,AccountId,Gas,NearToken,PanicOnDefault,Promise};
use near_sdk::collections::LookupMap;
use near_sdk::json_types::U128;
use near_sdk::serde_json::{self,json};
const DAY:u64=86_400_000_000_000;
const MAX_REQUESTS:usize=100;
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Policy{pub version:u64,pub daily:U128,pub per_payment:U128,pub approval_above:U128,pub recipients:Vec<AccountId>,pub ttl_seconds:u64}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Agent{pub active:bool,pub daily:U128}
#[near(serializers=[borsh,json])]
#[derive(Clone,PartialEq,Debug)]
pub enum Status{Approval,Dispatching,Settled,Failed,Rejected,Expired,Blocked}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Request{pub id:String,pub agent:AccountId,pub recipient:AccountId,pub amount:U128,pub reference:String,pub memo:String,pub fingerprint:String,pub policy_version:u64,pub created:u64,pub expires:u64,pub settled_at:Option<u64>,pub status:Status,pub reason:String}
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Aegis{owner:AccountId,policy:Policy,paused:bool,funded:u128,agents:LookupMap<AccountId,Agent>,requests:LookupMap<String,Request>,ids:Vec<String>}
#[near]
impl Aegis{
 #[init]
 pub fn new(owner:AccountId,daily:U128,per_payment:U128,approval_above:U128,recipients:Vec<AccountId>,ttl_seconds:u64)->Self{
  require!(env::predecessor_account_id()==env::current_account_id(),"Initialize through the treasury account");
  let policy=Policy{version:1,daily,per_payment,approval_above,recipients,ttl_seconds};Self::validate(&policy);
  Self{owner,policy,paused:false,funded:0,agents:LookupMap::new(b"a"),requests:LookupMap::new(b"r"),ids:vec![]}
 }
 pub fn get_config(&self)->serde_json::Value{json!({"owner":self.owner,"policy":self.policy,"paused":self.paused,"accounted_balance":U128(self.funded),"network_note":"NEAR native asset; amounts are yoctoNEAR","requests":self.ids.len()})}
 pub fn get_request(&self,id:String)->Option<Request>{self.requests.get(&id)}
 pub fn get_agent(&self,account:AccountId)->Option<Agent>{self.agents.get(&account)}
 pub fn list_requests(&self,from:Option<u64>,limit:Option<u64>)->Vec<Request>{self.ids.iter().skip(from.unwrap_or(0)as usize).take(limit.unwrap_or(30).min(100)as usize).filter_map(|id|self.requests.get(id)).collect()}
 #[payable]
 pub fn fund(&mut self){self.funded=self.funded.checked_add(env::attached_deposit().as_yoctonear()).expect("Balance overflow");self.event("funded",None);}
 pub fn register_agent(&mut self,account:AccountId,daily:U128){self.owner_only();require!(daily.0>0,"Budget must be positive");self.agents.insert(&account,&Agent{active:true,daily});self.event("agent_registered",None);}
 pub fn set_agent_active(&mut self,account:AccountId,active:bool){self.owner_only();let mut a=self.agents.get(&account).expect("Unknown agent");a.active=active;self.agents.insert(&account,&a);self.event(if active{"agent_resumed"}else{"agent_revoked"},None);}
 pub fn set_paused(&mut self,paused:bool){self.owner_only();self.paused=paused;self.event(if paused{"treasury_paused"}else{"treasury_resumed"},None);}
 pub fn update_policy(&mut self,daily:U128,per_payment:U128,approval_above:U128,recipients:Vec<AccountId>,ttl_seconds:u64){self.owner_only();let p=Policy{version:self.policy.version.checked_add(1).unwrap(),daily,per_payment,approval_above,recipients,ttl_seconds};Self::validate(&p);self.policy=p;for id in self.ids.clone(){let mut r=self.requests.get(&id).unwrap();if r.status==Status::Approval{r.status=Status::Rejected;r.reason="Policy changed; previous approval invalidated".into();self.requests.insert(&id,&r);}}self.event("policy_updated",None);}
 pub fn request_payment(&mut self,recipient:AccountId,amount:U128,reference:String,memo:String)->Request{
  let agent=env::predecessor_account_id();let a=self.agents.get(&agent).expect("Agent not registered");require!(!reference.is_empty()&&reference.len()<=100&&reference.bytes().all(|b|b.is_ascii_alphanumeric()||b"._:-".contains(&b)),"Invalid reference");require!(memo.len()<=500,"Memo too long");require!(amount.0>0,"Amount must be positive");
  let id=format!("{}:{}",agent,reference);let payload=serde_json::to_vec(&json!({"agent":agent,"recipient":recipient,"amount":amount,"reference":reference,"memo":memo})).unwrap();let fingerprint=env::sha256(&payload).iter().map(|x|format!("{x:02x}")).collect::<String>();
  if let Some(prior)=self.requests.get(&id){require!(prior.fingerprint==fingerprint,"REFERENCE_CONFLICT");self.event("request_replayed",Some(&id));return prior;}
  require!(self.ids.len()<MAX_REQUESTS,"Prototype request capacity reached");let now=env::block_timestamp();self.expire_pending(now);
  let reason=if self.paused{"Treasury paused"}else if !a.active{"Agent revoked"}else if !self.policy.recipients.contains(&recipient){"Recipient not approved"}else if amount.0>self.policy.per_payment.0{"Per-payment cap exceeded"}else if self.usage(now,None).checked_add(amount.0).unwrap()>self.policy.daily.0{"Shared 24-hour budget exceeded"}else if self.usage(now,Some(&agent)).checked_add(amount.0).unwrap()>a.daily.0{"Agent 24-hour budget exceeded"}else if self.reserved().checked_add(amount.0).unwrap()>self.funded{"Insufficient unreserved funds"}else{""};
  let r=Request{id:id.clone(),agent,recipient,amount,reference,memo,fingerprint,policy_version:self.policy.version,created:now,expires:now+self.policy.ttl_seconds*1_000_000_000,settled_at:None,status:if reason.is_empty(){Status::Approval}else{Status::Blocked},reason:if reason.is_empty(){"Awaiting exact owner approval".into()}else{reason.into()}};
  self.ids.push(id.clone());self.requests.insert(&id,&r);self.event("request_evaluated",Some(&id));if r.status==Status::Approval&&amount.0<=self.policy.approval_above.0{self.dispatch(id.clone());}self.requests.get(&id).unwrap()
 }
 pub fn approve(&mut self,id:String,fingerprint:String)->Request{self.owner_only();let r=self.requests.get(&id).expect("Unknown request");require!(r.fingerprint==fingerprint,"APPROVAL_MISMATCH");require!(r.status==Status::Approval,"Not awaiting approval");require!(r.policy_version==self.policy.version,"Stale policy");require!(env::block_timestamp()<r.expires,"Approval expired");require!(!self.paused,"Treasury paused");let a=self.agents.get(&r.agent).expect("Unknown agent");require!(a.active,"Agent revoked");require!(self.usage(env::block_timestamp(),Some(&r.agent))<=a.daily.0,"Agent budget changed");self.dispatch(id.clone());self.requests.get(&id).unwrap()}
 pub fn reject(&mut self,id:String){self.owner_only();let mut r=self.requests.get(&id).expect("Unknown request");require!(r.status==Status::Approval,"Not awaiting approval");r.status=Status::Rejected;r.reason="Rejected by owner".into();self.requests.insert(&id,&r);self.event("request_rejected",Some(&id));}
 pub fn expire_requests(&mut self){self.expire_pending(env::block_timestamp());}
 #[private]
 pub fn on_settlement(&mut self,id:String)->Request{let mut r=self.requests.get(&id).expect("Unknown request");require!(r.status==Status::Dispatching,"Already resolved");if env::promise_result_checked(0,1024).is_ok(){r.status=Status::Settled;r.settled_at=Some(env::block_timestamp());r.reason="Transfer receipt succeeded".into();}else{r.status=Status::Failed;r.reason="Transfer failed; accounted funds restored".into();self.funded=self.funded.checked_add(r.amount.0).unwrap();}self.requests.insert(&id,&r);self.event("settlement_resolved",Some(&id));r}
}
impl Aegis{
 fn owner_only(&self){require!(env::predecessor_account_id()==self.owner,"Owner required");}
 fn validate(p:&Policy){require!(p.approval_above.0>0&&p.approval_above.0<=p.per_payment.0&&p.per_payment.0<=p.daily.0,"Invalid spending limits");require!(p.ttl_seconds>0&&p.ttl_seconds<=86400,"Expiry must be within one day");require!(!p.recipients.is_empty()&&p.recipients.len()<=30,"Invalid recipients");}
 fn usage(&self,now:u64,agent:Option<&AccountId>)->u128{self.ids.iter().filter_map(|id|self.requests.get(id)).filter(|r|agent.is_none_or(|a|r.agent==*a)).filter(|r|match r.status{Status::Approval=>r.expires>now,Status::Dispatching=>true,Status::Settled=>r.settled_at.unwrap_or(r.created)>now.saturating_sub(DAY),_=>false}).map(|r|r.amount.0).sum()}
 fn reserved(&self)->u128{self.ids.iter().filter_map(|id|self.requests.get(id)).filter(|r|r.status==Status::Approval&&r.expires>env::block_timestamp()).map(|r|r.amount.0).sum()}
 fn expire_pending(&mut self,now:u64){for id in self.ids.clone(){let mut r=self.requests.get(&id).unwrap();if r.status==Status::Approval&&r.expires<=now{r.status=Status::Expired;r.reason="Approval expired; reservation released".into();self.requests.insert(&id,&r);self.event("approval_expired",Some(&id));}}}
 fn dispatch(&mut self,id:String){let mut r=self.requests.get(&id).unwrap();require!(r.status==Status::Approval,"Not executable");require!(r.amount.0<=self.funded,"Insufficient funds");self.funded-=r.amount.0;r.status=Status::Dispatching;r.reason="Transfer dispatched; settlement not yet confirmed".into();self.requests.insert(&id,&r);let args=serde_json::to_vec(&json!({"id":id})).unwrap();let _promise=Promise::new(r.recipient.clone()).transfer(NearToken::from_yoctonear(r.amount.0)).then(Promise::new(env::current_account_id()).function_call("on_settlement",args,NearToken::from_yoctonear(0),Gas::from_tgas(15)));self.event("transfer_dispatched",Some(&id));}
 fn event(&self,event:&str,id:Option<&String>){env::log_str(&format!("EVENT_JSON:{}",json!({"standard":"aegis","version":"1.0.0","event":event,"data":[{"request_id":id,"policy_version":self.policy.version,"actor":env::predecessor_account_id()}]})));}
}
#[cfg(test)]
mod tests{
 use super::*;use near_sdk::test_utils::VMContextBuilder;use near_sdk::testing_env;
 fn id(s:&str)->AccountId{s.parse().unwrap()}
 fn ctx(who:&str,time:u64){let mut b=VMContextBuilder::new();b.current_account_id(id("treasury.testnet")).predecessor_account_id(id(who)).signer_account_id(id(who)).block_timestamp(time).account_balance(NearToken::from_near(100));testing_env!(b.build());}
 fn fixture()->Aegis{ctx("treasury.testnet",DAY*2);let mut c=Aegis::new(id("owner.testnet"),U128(100),U128(100),U128(25),vec![id("vendor.testnet")],1800);c.funded=500;ctx("owner.testnet",DAY*2);c.register_agent(id("bot.testnet"),U128(100));c.register_agent(id("other.testnet"),U128(100));c}
 fn req(c:&mut Aegis,n:u128,r:&str)->Request{ctx("bot.testnet",DAY*2);c.request_payment(id("vendor.testnet"),U128(n),r.into(),"Compute".into())}
 #[test]fn blocks_unknown_recipient(){let mut c=fixture();ctx("bot.testnet",DAY*2);assert_eq!(c.request_payment(id("evil.testnet"),U128(12),"a".into(),"".into()).status,Status::Blocked);assert_eq!(c.funded,500);}
 #[test]fn duplicate_dispatches_once(){let mut c=fixture();let a=req(&mut c,12,"a");let b=req(&mut c,12,"a");assert_eq!(a.id,b.id);assert_eq!(c.funded,488);}
 #[test]fn shared_budget_includes_reservations(){let mut c=fixture();assert_eq!(req(&mut c,60,"a").status,Status::Approval);ctx("other.testnet",DAY*2);assert_eq!(c.request_payment(id("vendor.testnet"),U128(60),"b".into(),"".into()).status,Status::Blocked);}
 #[test]fn revoked_agent_cannot_request(){let mut c=fixture();c.set_agent_active(id("bot.testnet"),false);assert_eq!(req(&mut c,12,"a").status,Status::Blocked);}
 #[test]fn policy_change_invalidates_approval(){let mut c=fixture();let r=req(&mut c,60,"a");ctx("owner.testnet",DAY*2);c.update_policy(U128(90),U128(90),U128(25),vec![id("vendor.testnet")],1800);assert_eq!(c.get_request(r.id).unwrap().status,Status::Rejected);assert_eq!(c.usage(DAY*2,None),0);}
 #[test]fn expiry_releases_reservation(){let mut c=fixture();let r=req(&mut c,60,"a");ctx("bot.testnet",DAY*2+1_801_000_000_000);c.expire_requests();assert_eq!(c.get_request(r.id).unwrap().status,Status::Expired);assert_eq!(c.usage(env::block_timestamp(),None),0);}
 #[test]fn owner_can_approve_exact_request(){let mut c=fixture();let r=req(&mut c,60,"a");ctx("owner.testnet",DAY*2);assert_eq!(c.approve(r.id,r.fingerprint).status,Status::Dispatching);assert_eq!(c.funded,440);}
 #[test]#[should_panic(expected="APPROVAL_MISMATCH")]fn altered_approval_fails(){let mut c=fixture();let r=req(&mut c,60,"a");ctx("owner.testnet",DAY*2);c.approve(r.id,"wrong".into());}
 #[test]#[should_panic(expected="Owner required")]fn agent_cannot_change_policy(){let mut c=fixture();ctx("bot.testnet",DAY*2);c.set_paused(false);}
 #[test]#[should_panic(expected="Agent budget changed")]fn lower_agent_budget_blocks_prior_approval(){let mut c=fixture();let r=req(&mut c,60,"a");ctx("owner.testnet",DAY*2);c.register_agent(id("bot.testnet"),U128(30));c.approve(r.id,r.fingerprint);}
 #[test]#[allow(deprecated)]fn successful_callback_confirms_receipt(){let mut c=fixture();let r=req(&mut c,12,"a");let mut b=VMContextBuilder::new();b.current_account_id(id("treasury.testnet")).predecessor_account_id(id("treasury.testnet")).block_timestamp(DAY*2);near_sdk::test_utils::testing_env_with_promise_results(b.build(),near_sdk::PromiseResult::Successful(vec![]));assert_eq!(c.on_settlement(r.id).status,Status::Settled);assert_eq!(c.funded,488);}
 #[test]#[allow(deprecated)]fn failed_transfer_restores_accounted_balance(){let mut c=fixture();let r=req(&mut c,12,"a");let mut b=VMContextBuilder::new();b.current_account_id(id("treasury.testnet")).predecessor_account_id(id("treasury.testnet")).block_timestamp(DAY*2);near_sdk::test_utils::testing_env_with_promise_results(b.build(),near_sdk::PromiseResult::Failed);assert_eq!(c.on_settlement(r.id).status,Status::Failed);assert_eq!(c.funded,500);assert_eq!(c.usage(DAY*2,None),0);}
}
