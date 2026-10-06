import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
import {db} from "../src/lib/db";
import {onTripCompleted,executePayout} from "../src/lib/money";
import {settleCallback} from "../src/lib/payout-settlement";
import {createHash,randomBytes} from "node:crypto";

async function main() {
const base="http://127.0.0.1:3100";
if(process.env.DATABASE_URL!=="file:./preview.db" || process.env.NODE_ENV!=="development" || process.env.MIRELI_DEMO_MODE!=="true" || process.env.VERCEL || process.env.MPESA_MODE!=="mock")throw new Error("Refused: only the isolated synthetic preview is allowed.");
const status=await fetch(`${base}/api/v1/driver/status`).then(r=>r.json());assert.equal(status.simulation,true);
let token="",cookie="";
async function api(path:string,method="GET",body?:unknown,headers:Record<string,string>={},expected=200) {
  const response=await fetch(`${base}${path}`,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(cookie?{Cookie:cookie}:{ }),...(body&&!Buffer.isBuffer(body)?{"Content-Type":"application/json"}:{}),...headers},body:body?Buffer.isBuffer(body)?new Uint8Array(body):JSON.stringify(body):undefined});
  const result=await response.json();assert.equal(response.status,expected,`${method} ${path}: ${result.error||"unexpected status"}`);return result;
}
try {
  const phone=`+254700${Date.now().toString().slice(-6)}`;
  const challenge=await api("/api/v1/driver/auth/challenges","POST",{phone});assert.equal(typeof challenge.demoCode,"string");
  await api("/api/v1/driver/auth/sessions","POST",{challengeId:challenge.challengeId,code:"wrong!",deviceId:"sample-device-test"},{},401);
  const session=await api("/api/v1/driver/auth/sessions","POST",{challengeId:challenge.challengeId,code:challenge.demoCode,deviceId:"sample-device-test"});token=session.token;assert.equal(session.simulation,true);
  await api("/api/v1/driver/auth/sessions","POST",{challengeId:challenge.challengeId,code:challenge.demoCode,deviceId:"sample-device-test"},{},401);
  let app=await api("/api/v1/driver/onboarding");
  app=await api("/api/v1/driver/onboarding","PUT",{expectedVersion:app.application.version,fullName:"SYNTHETIC Driver API Test",plate:"DEMO 003",capacity:10,licenceClass:"D1",cabType:"Sample shuttle",ownsVehicle:true});
  await api("/api/v1/driver/onboarding","PUT",{expectedVersion:0,fullName:"Stale edit",plate:"DEMO 003",capacity:10,licenceClass:"D1",cabType:"Sample shuttle",ownsVehicle:true},{},409);
  await api("/api/v1/driver/onboarding/submissions","POST",{expectedVersion:app.application.version,policyVersion:app.policyVersion,accepted:true},{},400);
  const fixture=Buffer.from("%PDF-1.4\nSYNTHETIC TEST EVIDENCE ONLY\n%%EOF");
  for(const requirement of app.requirements.filter((r:{required:boolean})=>r.required)) {
    app=await api(`/api/v1/driver/documents/${requirement.id}`,"POST",fixture,{"Content-Type":"application/pdf","x-application-version":String(app.application.version),...(requirement.expires?{"x-document-expiry":"2028-12-31"}:{})});
  }
  app=await api("/api/v1/driver/onboarding/submissions","POST",{expectedVersion:app.application.version,policyVersion:app.policyVersion,accepted:true});assert.equal(app.application.status,"submitted");
  assert.equal((await api("/api/v1/driver/me")).eligibility.eligible,false);
  await api("/api/admin/driver-onboarding","GET",undefined,{},401);
  const adminResponse=await fetch(`${base}/api/admin/auth`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({step:"verify",email:"mirelisgr001@gmail.com",code:"1234",twofa:"LOCAL-ONLY"})});
  assert.equal(adminResponse.status,200);cookie=adminResponse.headers.get("set-cookie")?.split(";")[0]||"";assert.ok(cookie);
  await api("/api/admin/driver-onboarding","POST",{applicationId:app.application.id,expectedVersion:app.application.version,action:"approve"},{Origin:base},409);
  for(const document of app.application.documents) {
    await api("/api/admin/driver-onboarding","POST",{applicationId:app.application.id,expectedVersion:app.application.version,action:"approve_document",documentId:document.id},{Origin:base});
    app=await api("/api/v1/driver/onboarding");
  }
  await api("/api/admin/driver-onboarding","POST",{applicationId:app.application.id,expectedVersion:app.application.version,action:"approve"},{Origin:base});
  assert.equal((await api("/api/v1/driver/me")).eligibility.eligible,true);
  const driverId=session.driver.id;
  const route=await db.route.findFirst({where:{id:"preview-route-0"}});assert.ok(route);
  const trip=await db.trip.create({data:{driverId,routeId:route.id,direction:"FROM_TERMINUS",departureAt:new Date(),capacity:10,status:"locked"}});
  const passenger=await db.passenger.create({data:{phone:`sample-api-${randomBytes(8).toString("hex")}`,name:"Synthetic Passenger"}});
  const booking=await db.booking.create({data:{code:`TEST-${randomBytes(8).toString("hex")}`,passengerId:passenger.id,tripId:trip.id,routeId:route.id,direction:"FROM_TERMINUS",seats:2,fareAmount:1100,homeSurcharge:100,creditApplied:0,cashDue:1100,status:"confirmed"}});
  const ledger=await db.ledgerEntry.create({data:{bookingId:booking.id,tripId:trip.id,totalAmount:1100,cashAmount:1100,creditApplied:0,homeSurchargeAmount:100,status:"held"}});
  const assigned=(await api("/api/v1/driver/trips")).trips.find((t:{id:string})=>t.id===trip.id);
  assert.equal(assigned.passengers[0].code,undefined);assert.equal(assigned.passengers[0].phone,null);
  const commandPath=`/api/v1/driver/trips/${trip.id}/commands`;
  const accept={action:"accept",expectedVersion:0,clientActionId:randomBytes(16).toString("hex")};
  assert.deepEqual(await api(commandPath,"POST",accept),await api(commandPath,"POST",accept));
  await api(commandPath,"POST",{...accept,action:"decline",reason:"Different request"},{},409);
  await api(commandPath,"POST",{action:"arrive",expectedVersion:0,clientActionId:randomBytes(16).toString("hex")},{},409);
  await api(commandPath,"POST",{action:"arrive",expectedVersion:1,clientActionId:randomBytes(16).toString("hex")});
  await api(commandPath,"POST",{action:"board",expectedVersion:2,clientActionId:randomBytes(16).toString("hex"),bookingId:booking.id,code:"WRONG-CODE",count:2},{},400);
  await api(commandPath,"POST",{action:"start",expectedVersion:2,clientActionId:randomBytes(16).toString("hex")},{},409);
  const board={action:"board",expectedVersion:2,clientActionId:randomBytes(16).toString("hex"),bookingId:booking.id,code:booking.code,count:2};
  await api(commandPath,"POST",board);await api(commandPath,"POST",board);
  await api(commandPath,"POST",{action:"start",expectedVersion:3,clientActionId:randomBytes(16).toString("hex")});
  const complete={action:"complete",expectedVersion:4,clientActionId:randomBytes(16).toString("hex")};
  await api(commandPath,"POST",complete);await api(commandPath,"POST",complete);await onTripCompleted(trip.id);
  assert.equal((await api("/api/v1/driver/trips")).trips.find((t:{id:string})=>t.id===trip.id).passengers.length,0);
  const payouts=await db.payoutRecord.findMany({where:{ledgerEntryId:ledger.id}});assert.equal(payouts.length,1);assert.equal(payouts[0].netPayoutAmount,950);
  await assert.rejects(executePayout(payouts[0].id),/beneficiary/i);
  await api("/api/v1/driver/payout-destination","POST",{expectedVersion:0,accountName:"SYNTHETIC Driver API Test",acknowledged:true});
  const beneficiary=await db.driverPayoutDestination.findUniqueOrThrow({where:{driverId}});
  await api("/api/admin/driver-payout-destinations","POST",{id:beneficiary.id,expectedVersion:0,action:"approve",note:"Synthetic ownership check only; not provider proof."},{Origin:base});
  assert.equal((await api("/api/v1/driver/earnings")).destination.status,"approved");
  assert.equal(await executePayout(payouts[0].id),true);assert.equal(await executePayout(payouts[0].id),true);
  assert.equal(await db.payoutAttempt.count({where:{payoutId:payouts[0].id}}),1);
  const statement=await api("/api/v1/driver/earnings");assert.equal(statement.lines[0].netMinor,95000);assert.equal(statement.lines[0].status,"completed");
  await db.platformConfig.update({where:{id:"main"},data:{payoutMode:"instant_per_trip"}});
  const autoTrip=await db.trip.create({data:{driverId,routeId:route.id,direction:"FROM_TERMINUS",departureAt:new Date(),capacity:10,status:"departed",driverProgress:{create:{driverId,phase:"in_progress"}}}});
  await db.booking.create({data:{code:`TEST-${randomBytes(8).toString("hex")}`,passengerId:passenger.id,tripId:autoTrip.id,routeId:route.id,direction:"FROM_TERMINUS",seats:1,boardedSeats:1,fareAmount:1000,homeSurcharge:0,creditApplied:0,cashDue:1000,status:"boarded",ledgerEntry:{create:{tripId:autoTrip.id,totalAmount:1000,cashAmount:1000,creditApplied:0,homeSurchargeAmount:0,status:"held"}}}});
  const autoCommand={action:"complete",expectedVersion:0,clientActionId:randomBytes(16).toString("hex")};
  const autoPath=`/api/v1/driver/trips/${autoTrip.id}/commands`;
  await api(autoPath,"POST",autoCommand);await api(autoPath,"POST",autoCommand);
  const deadline=Date.now()+15000;
  let automatic=await db.payoutRecord.findFirstOrThrow({where:{tripId:autoTrip.id}});
  while(!automatic.settlementVerified && Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,100));automatic=await db.payoutRecord.findUniqueOrThrow({where:{id:automatic.id}});}
  assert.equal(automatic.settlementVerified,true);assert.equal(await db.payoutAttempt.count({where:{payoutId:automatic.id}}),1);
  await db.platformConfig.update({where:{id:"main"},data:{payoutMode:"weekly"}});
  // A partial party/no-show must preserve funds for review, never invent a driver entitlement.
  const partial=await db.trip.create({data:{driverId,routeId:route.id,direction:"FROM_TERMINUS",departureAt:new Date(Date.now()-60000),capacity:10,status:"locked"}});
  const partialBooking=await db.booking.create({data:{code:`TEST-${randomBytes(8).toString("hex")}`,passengerId:passenger.id,tripId:partial.id,routeId:route.id,direction:"FROM_TERMINUS",seats:2,fareAmount:1000,homeSurcharge:0,creditApplied:0,cashDue:1000,status:"confirmed"}});
  const partialLedger=await db.ledgerEntry.create({data:{bookingId:partialBooking.id,tripId:partial.id,totalAmount:1000,cashAmount:1000,creditApplied:0,homeSurchargeAmount:0,status:"held"}});
  const partialPath=`/api/v1/driver/trips/${partial.id}/commands`;
  let partialVersion=0;
  for(const data of [{action:"accept"},{action:"arrive"},{action:"board",bookingId:partialBooking.id,code:partialBooking.code,count:1},{action:"no_show",bookingId:partialBooking.id,reason:"Synthetic: remaining passenger did not arrive"},{action:"start"},{action:"complete"}]) {
    await api(partialPath,"POST",{...data,expectedVersion:partialVersion++,clientActionId:randomBytes(16).toString("hex")});
  }
  assert.equal((await db.ledgerEntry.findUniqueOrThrow({where:{id:partialLedger.id}})).status,"held");
  assert.equal((await db.payoutRecord.findUniqueOrThrow({where:{ledgerEntryId:partialLedger.id}})).status,"needs_review");
  const supportId=randomBytes(16).toString("hex");
  const supportBody={clientActionId:supportId,category:"payout",message:"Synthetic test: please review my sample statement."};
  const cases=await api("/api/v1/driver/support","POST",supportBody);
  assert.equal((await api("/api/v1/driver/support","POST",supportBody)).cases.length,cases.cases.length);
  await api("/api/v1/driver/support","POST",{...supportBody,message:"A different synthetic message"},{},409);
  const supportCase=cases.cases[0];
  await api("/api/admin/driver-support","POST",{id:supportCase.id,expectedVersion:0,status:"resolved",reply:"Synthetic case reviewed; no real transfer occurred."},{Origin:base});
  assert.equal((await api("/api/v1/driver/support")).cases[0].status,"resolved");
  // Exercise asynchronous result correlation without issuing a transfer.
  const pending=await db.payoutRecord.create({data:{driverId,grossFareTotal:100,commissionAmount:0,homeSurchargeAmount:0,netPayoutAmount:100,status:"processing"}});
  const capability=randomBytes(32).toString("hex");
  const origin=`SYNTH-${randomBytes(8).toString("hex")}`,conversation=`SYNTH-${randomBytes(8).toString("hex")}`,receipt=`D${randomBytes(5).toString("hex").toUpperCase()}`;
  await db.payoutAttempt.create({data:{payoutId:pending.id,callbackHash:createHash("sha256").update(capability).digest("hex"),receiverPhone:phone,amount:100,state:"processing",originatorId:origin,conversationId:conversation}});
  const result={ResultCode:0,OriginatorConversationID:origin,ConversationID:conversation,TransactionID:receipt,ResultParameters:{ResultParameter:[{Key:"TransactionAmount",Value:100},{Key:"ReceiverPartyPublicName",Value:`${phone.slice(1)} - SAMPLE`}]}};
  await assert.rejects(settleCallback(capability,{...result,ResultParameters:{ResultParameter:[{Key:"TransactionAmount",Value:999}]}}));
  assert.equal((await settleCallback(capability,result)).duplicate,false);assert.equal((await settleCallback(capability,result)).duplicate,true);
  await assert.rejects(settleCallback(capability,{...result,TransactionID:"DIFF123456"}));
  const approved=await api("/api/v1/driver/onboarding");
  await api(`/api/v1/driver/documents/identity`,"POST",Buffer.from("MZ executable"),{"Content-Type":"application/pdf","x-application-version":String(approved.application.version)},400);
  await api("/api/v1/driver/auth/session","DELETE");await api("/api/v1/driver/me","GET",undefined,{},401);
  if(process.env.MIRELI_NATIVE_FIXTURE==="true") {
    const nativeTrip=await db.trip.create({data:{driverId,routeId:route.id,direction:"FROM_TERMINUS",departureAt:new Date(),capacity:10,status:"locked"}});
    const nativeBooking=await db.booking.create({data:{code:`NATIVE-${randomBytes(5).toString("hex").toUpperCase()}`,passengerId:passenger.id,tripId:nativeTrip.id,routeId:route.id,direction:"FROM_TERMINUS",seats:2,isCharter:true,fareAmount:2000,homeSurcharge:0,creditApplied:0,cashDue:2000,status:"confirmed"}});
    await db.ledgerEntry.create({data:{bookingId:nativeBooking.id,tripId:nativeTrip.id,totalAmount:2000,cashAmount:2000,creditApplied:0,homeSurchargeAmount:0,status:"held"}});
    await writeFile(".local/native-test-fixture.json",JSON.stringify({phone,tripId:nativeTrip.id,code:nativeBooking.code}));
  }
  console.log("PASS: OTP/replay, profile concurrency, private documents, approval, assigned trip/boarding commands, action replay, partial no-show hold, ledger settlement, payout callbacks, support replies and logout. Synthetic records preserved.");
}finally{await db.$disconnect();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Driver API test failed");process.exitCode=1;});
