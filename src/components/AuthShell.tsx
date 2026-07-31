import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">{subtitle}</p>
      </div>
      {children}
      <p className="text-center text-sm text-muted">{footer}</p>
    </div>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-lg border border-edge bg-surface px-3 py-2.5 text-base outline-none focus:border-accent"
      />
    </label>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-accent underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
