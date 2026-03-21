import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { Suspense } from 'react';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center text-slate-500">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
