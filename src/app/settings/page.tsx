import { redirect } from "next/navigation";
import SettingsScreen from "@/components/SettingsScreen";
import { getProfile } from "@/lib/profile";
import { getUserId } from "@/lib/session";

export default async function Page() {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  return <SettingsScreen initialProfile={await getProfile(userId)} />;
}
