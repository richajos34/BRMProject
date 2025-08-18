export default function AuthLayout({ children }: { children: React.ReactNode }) {
    // Simple, shell-free wrapper
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
    );
  }
  