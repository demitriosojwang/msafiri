import {describe,it,expect,vi} from "vitest";
const config=vi.hoisted(()=>({findUnique:vi.fn(),create:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{platformConfig:config}}));
import {getConfig} from "@/lib/money";

describe("empty deployment",()=>{
  it("does not manufacture operating settings or demo administrators on a read",async()=>{
    config.findUnique.mockResolvedValue(null);
    await expect(getConfig()).rejects.toMatchObject({status:503,code:"PLATFORM_NOT_CONFIGURED"});
    expect(config.create).not.toHaveBeenCalled();
  });
  it("preserves an existing operator configuration",async()=>{
    const approved={id:"main",commissionRate:0.15};config.findUnique.mockResolvedValue(approved);
    expect(await getConfig()).toBe(approved);expect(config.create).not.toHaveBeenCalled();
  });
});
