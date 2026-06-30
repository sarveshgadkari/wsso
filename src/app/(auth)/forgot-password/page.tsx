import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata: Metadata = { title: 'Forgot Password — WSSO' }

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">Reset your password</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Enter your email and we&#39;ll send you a reset link.
        </p>
      </div>
      <ForgotPasswordForm />
    </>
  )
}
