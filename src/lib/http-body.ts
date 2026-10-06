import {DriverError} from "@/lib/driver/errors";
export async function readBoundedBody(req:Request,max:number):Promise<Buffer> {
  if(Number(req.headers.get("content-length")||0)>max)throw new DriverError(413,"BODY_TOO_LARGE","Request exceeds the allowed size.");
  const reader=req.body?.getReader();if(!reader)return Buffer.alloc(0);
  const chunks:Uint8Array[]=[];let length=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw new DriverError(413,"BODY_TOO_LARGE","Request exceeds the allowed size.");}chunks.push(value);}}
  finally {reader.releaseLock();}
  return Buffer.concat(chunks);
}
