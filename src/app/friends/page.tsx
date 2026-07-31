import { redirect } from "next/navigation";
import FriendsScreen from "@/components/FriendsScreen";
import { getFriendRequests } from "@/lib/friendRequests";
import { getProfile } from "@/lib/profile";
import { buildRadarPayload } from "@/lib/radar";
import { getUserId } from "@/lib/session";

export default async function Page() {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const [profile, radar, requests] = await Promise.all([
    getProfile(userId),
    buildRadarPayload(userId),
    getFriendRequests(userId),
  ]);

  // Jeton geçerli ama kullanıcı yok (hesap silinmiş): oturumu bitir.
  if (!profile || !radar) redirect("/login");

  return (
    <FriendsScreen
      initialProfile={profile}
      initialRadar={radar}
      initialRequests={requests}
    />
  );
}
