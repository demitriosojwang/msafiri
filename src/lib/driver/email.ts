import {DriverError} from "./errors";

export function emailAddress(value:unknown):string {
  if(typeof value!=="string" || /[\r\n]/.test(value))throw new DriverError(400,"INVALID_EMAIL","Enter a valid email address.");
  const email=value.trim().toLowerCase();
  if(email.length>254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email))
    throw new DriverError(400,"INVALID_EMAIL","Enter a valid email address.");
  return email;
}
export function emailSignInConfigured():boolean {
  try {return (process.env.DRIVER_AUTH_SECRET?.length??0)>=32 && !!process.env.BREVO_API_KEY?.trim() && !!emailAddress(process.env.BREVO_SENDER_EMAIL);}
  catch{return false;}
}
export async function sendEmailCode(email:string,code:string):Promise<void> {
  if(!/^[0-9]{6}$/.test(code))throw new DriverError(400,"INVALID_CODE","Invalid verification code.");
  try {
    const response=await fetch("https://api.brevo.com/v3/smtp/email",{
      method:"POST",headers:{"api-key":process.env.BREVO_API_KEY!,Accept:"application/json","Content-Type":"application/json"},
      body:JSON.stringify({sender:{email:emailAddress(process.env.BREVO_SENDER_EMAIL),name:"Mireli Driver"},to:[{email:emailAddress(email)}],
        subject:"Your Mireli Driver verification code",
        textContent:`Your Mireli Driver verification code is ${code}.\n\nIt expires in 5 minutes. Do not share this code.\nIf you did not request it, you can ignore this email.`,tags:["driver-verification"]}),
      signal:AbortSignal.timeout(10000)
    });
    const result=await response.json();
    if(!response.ok || typeof result.messageId!=="string" || !result.messageId)throw new Error();
  }catch{throw new DriverError(503,"EMAIL_UNAVAILABLE","The verification email could not be sent. Please try again later.");}
}
