import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/client");
  return children;
}
