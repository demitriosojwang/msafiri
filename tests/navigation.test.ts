import {afterEach,describe,expect,it,vi} from "vitest";
import {navigationRoutingConfigured,normalizeValhallaRoute} from "@/lib/driver/navigation";

afterEach(()=>vi.unstubAllEnvs());

describe("open-source driver route service",()=>{
  it("accepts only a configured HTTPS Valhalla endpoint",()=>{
    expect(navigationRoutingConfigured()).toBe(false);
    vi.stubEnv("VALHALLA_URL","http://127.0.0.1:8002/route");expect(navigationRoutingConfigured()).toBe(false);
    vi.stubEnv("VALHALLA_URL","https://localhost/route");expect(navigationRoutingConfigured()).toBe(false);
    vi.stubEnv("VALHALLA_URL","https://routes.example/route?url=https://evil.example");expect(navigationRoutingConfigured()).toBe(false);
    vi.stubEnv("VALHALLA_URL","https://routing.mireli.co.ke/route");expect(navigationRoutingConfigured()).toBe(false);
    vi.stubEnv("VALHALLA_API_TOKEN","t".repeat(40));expect(navigationRoutingConfigured()).toBe(true);
  });
  it("normalizes route shape and instructions while stripping control characters",()=>{
    const result=normalizeValhallaRoute({trip:{legs:[{shape:"encoded-polyline",summary:{length:12.34,time:900},maneuvers:[
      {instruction:"Turn left\n<script>unsupported</script>",length:0.4,time:30,begin_shape_index:0,end_shape_index:12},
    ]}]}});
    expect(result).toEqual({provider:"valhalla",geometry:"encoded-polyline",distanceMeters:12340,durationSeconds:900,
      maneuvers:[{instruction:"Turn left <script>unsupported</script>",distanceMeters:400,durationSeconds:30,beginShapeIndex:0,endShapeIndex:12}]});
  });
  it("rejects malformed, empty, oversized, and impossible routes",()=>{
    expect(()=>normalizeValhallaRoute(null)).toThrow();
    expect(()=>normalizeValhallaRoute({trip:{legs:[]}})).toThrow();
    expect(()=>normalizeValhallaRoute({trip:{legs:[{shape:"x",summary:{length:600,time:900},maneuvers:[]}]}})).toThrow();
  });
});
