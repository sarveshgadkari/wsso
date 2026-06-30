import type { Metadata } from 'next'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export const metadata: Metadata = { title: 'Set New Password — WSSO' }

export default function ResetPasswordPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">Set a new password</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Your new password must be at least 8 characters.
        </p>
      </div>
      <ResetPasswordForm />
    </>
  )
}
