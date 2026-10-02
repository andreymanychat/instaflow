import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { loadBillingProfile } from "@/server/billing/billing-service";
import { ProfileForm } from "@/components/account/profile-form";
import { AvatarUpload } from "@/components/account/avatar-upload";
import { DeleteAccountCard } from "@/components/account/delete-account-card";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const user = await requireUser();
  // Dados cadastrais completos só são lidos no servidor e só do próprio usuário
  const profile = await loadBillingProfile(user.id);

  return (
    <div className="space-y-6">
      <AvatarUpload userId={user.id} name={profile.full_name ?? ""} email={user.email ?? ""} avatarUrl={profile.avatar_url} />
      <ProfileForm
        email={user.email ?? ""}
        initial={{
          fullName: profile.full_name ?? "",
          personType: profile.person_type ?? "pf",
          document: profile.document ?? "",
          companyName: profile.company_name ?? "",
          phone: profile.phone ?? "",
          postalCode: profile.postal_code ?? "",
          street: profile.street ?? "",
          addressNumber: profile.address_number ?? "",
          complement: profile.complement ?? "",
          district: profile.district ?? "",
          city: profile.city ?? "",
          state: profile.state ?? "",
        }}
      />
      <DeleteAccountCard email={user.email ?? ""} />
    </div>
  );
}
