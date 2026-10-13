import { ShieldCheck } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-plant text-white">
            <ShieldCheck size={22} aria-hidden />
          </span>
          <span className="font-display text-2xl font-semibold">SafetyComply AI</span>
        </div>
        {children}
      </div>
    </main>
  );
}
