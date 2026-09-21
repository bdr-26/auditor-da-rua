import { redirect } from "next/navigation";
import { getSessionProfile, homeForRole } from "@/lib/auth";

export default async function RootPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  redirect(homeForRole(profile.role));
}
