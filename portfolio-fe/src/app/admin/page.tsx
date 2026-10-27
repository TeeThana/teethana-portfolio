import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession, SESSION_COOKIE } from "@/server/auth";
import { getStore } from "@/server/store";
import { AdminWorkspace } from "@/components/admin-workspace";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Owner workspace",
  robots: { index: false, follow: false },
};
export default async function Admin() {
  const owner = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!owner) redirect("/login");
  return (
    <AdminWorkspace initial={getStore().portfolio(true)} owner={owner.login} />
  );
}
