import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { LocalResetPasswordForm } from '@/components/auth/LocalResetPasswordForm';
import { isDesktop } from '@/lib/appMode';

export default function ForgotPasswordPage() {
  return isDesktop() ? <LocalResetPasswordForm /> : <ForgotPasswordForm />;
}
