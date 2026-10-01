import { PageBody, PageHeader } from "@/components/layout/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Configurações" description="Organização, contas do Instagram e equipe" />
      <PageBody>
        <div className="flex flex-col gap-6 lg:flex-row">
          <SettingsNav />
          <div className="min-w-0 max-w-3xl flex-1">{children}</div>
        </div>
      </PageBody>
    </>
  );
}
