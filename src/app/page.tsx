import { redirect } from "next/navigation";
import RadarScreen from "@/components/RadarScreen";
import { getUserId } from "@/lib/session";

export default async function Page() {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  return <RadarScreen />;
}
