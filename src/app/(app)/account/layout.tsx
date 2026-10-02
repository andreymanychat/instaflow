import { PageBody, PageHeader } from "@/components/layout/page-header";
import { AccountNav } from "@/components/account/account-nav";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Minha conta" description="Seus dados, pagamentos e indicações" />
      <PageBody>
        <div className="flex flex-col gap-6 lg:flex-row">
          <AccountNav />
          <div className="min-w-0 max-w-3xl flex-1">{children}</div>
        </div>
      </PageBody>
    </>
  );
}
