import { db } from "@/lib/db";

export async function audit(params: {
  actorId: string;
  actorName: string;
  actorRole: "passenger" | "admin" | "system";
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.auditLog.create({
      data: {
        actorId: params.actorId,
        actorName: params.actorName,
        actorRole: params.actorRole,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
