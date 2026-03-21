export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 z-10 relative">
      <div className="w-full max-w-[440px]">
        {children}
      </div>
    </div>
  );
}
