import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { AdminChrome } from "@/components/admin/admin-nav";

export default async function AdminDashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AdminChrome adminName={session.name} adminEmail={session.identifier} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8">{children}</main>
      <footer className="mt-auto border-t bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-2 text-center text-[10px] text-muted-foreground">
          Mi-Reli Admin · oversight only · engine runs the money
        </div>
      </footer>
    </div>
  );
}
