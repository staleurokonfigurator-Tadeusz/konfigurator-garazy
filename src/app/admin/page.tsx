import { ArrowRight, FileText, ShieldCheck } from 'lucide-react';

const wordpressAdminUrl = process.env.WP_ADMIN_URL || 'https://konfigurator.staleuro.pl/wp-admin/admin.php?page=garage-orders';

export default function AdminPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
      <section className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl md:p-12">
        <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600">
          <FileText size={28} />
        </div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-orange-500">Stal Euro</p>
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">Panel ofert działa w WordPressie</h1>
        <p className="mt-5 leading-7 text-zinc-300">
          Dostęp do konfiguracji klientów i tworzenia ofert wymaga uwierzytelnionej sesji WordPress.
          W zamówieniach wybierz konfigurację, a następnie użyj przycisku „Przygotuj ofertę”.
        </p>
        <div className="mt-7 flex gap-3 rounded-2xl border border-emerald-900/60 bg-emerald-950/30 p-4 text-sm text-emerald-100">
          <ShieldCheck className="mt-0.5 shrink-0" size={20} />
          <p>Usunięto wcześniejsze hasło zapisane w kodzie przeglądarki. Uprawnienia administratora są teraz pozostawione WordPressowi.</p>
        </div>
        <a href={wordpressAdminUrl} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-4 font-black transition-colors hover:bg-orange-700">
          Przejdź do zamówień WordPress <ArrowRight size={19} />
        </a>
      </section>
    </main>
  );
}
