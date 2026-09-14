import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";

/** Audit log — who did what, when. Append-only. */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");

  const logs = await db.auditLog.findMany({
    where: role ? { actorRole: role } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    logs: logs.map((l) => {
      let metadata: Record<string, unknown> | null = null;
      try {
        metadata = l.metadata ? JSON.parse(l.metadata) : null;
      } catch {
        metadata = null;
      }
      return {
        id: l.id,
        actorId: l.actorId,
        actorName: l.actorName,
        actorRole: l.actorRole,
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        metadata,
        createdAt: l.createdAt,
      };
    }),
  });
}
