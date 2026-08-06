import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "client") redirect("/coach");
  return children;
}
