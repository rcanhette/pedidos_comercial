import { requireUser } from "@/server/auth";
import { ProfileForm } from "@/features/admin/profile-form";

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Meu perfil</h1>
      <ProfileForm user={user} />
    </div>
  );
}
