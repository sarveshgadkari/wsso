import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = { title: 'Sign In — WSSO' }

interface Props {
  searchParams: { error?: string; signup?: string }
}

export default function LoginPage({ searchParams }: Props) {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">Welcome back</h1>
        <p className="mt-1 text-sm text-neutral-500">Sign in to your WSSO account</p>
      </div>

      {searchParams.signup === '1' && (
        <div className="mb-4 rounded-md border border-success-500/30 bg-success-50 px-4 py-3 text-sm text-success-700">
          Workspace created. Sign in with the email and password you just chose.
        </div>
      )}

      {searchParams.error === 'account_inactive' && (
        <div className="mb-4 rounded-md border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Your account has been deactivated. Contact your administrator to regain access.
        </div>
      )}

      {searchParams.error === 'org_blocked' && (
        <div className="mb-4 rounded-md border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          This workspace is suspended, cancelled, or the trial has ended. Contact support.
        </div>
      )}

      {searchParams.error === 'no_workspace' && (
        <div className="mb-4 rounded-md border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Your account is not attached to a workspace. Contact support.
        </div>
      )}

      <LoginForm />
    </>
  )
}
