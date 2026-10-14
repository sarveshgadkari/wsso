import type { Metadata } from 'next'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'
import { omniforceSsoEnabled } from '@/lib/omniforce/config'

const OMNIFORCE_ERRORS: Record<string, string> = {
  omniforce_unavailable: 'Sign-in with Omni Force Vector is not available right now. Try again later or use your WSSO password.',
  omniforce_expired: 'That sign-in took too long or was opened in another browser. Please try again.',
  omniforce_denied: 'Omni Force Vector did not allow this sign-in. Check that WSSO is enabled for your account.',
  omniforce_failed: 'We could not complete sign-in with Omni Force Vector. Please try again.',
  omniforce_no_access: 'Your Omni Force Vector account does not include WSSO yet. Ask your administrator to enable it.',
  omniforce_account_inactive: 'Your WSSO account was deactivated by your workspace admin.',
  omniforce_email_unverified: 'Verify your email address in Omni Force Vector first, then try again.',
  omniforce_email_in_use: 'A WSSO account already uses your email. Sign in below with your WSSO password, or contact support to connect it to Omni Force Vector.',
  omniforce_workspace_not_ready: "Your organization's WSSO workspace isn't set up yet. Ask an organization owner to open WSSO first.",
  omniforce_workspace_mismatch: 'Your WSSO account belongs to a different workspace. Open WSSO from the matching account or organization in Omni Force Vector.',
  omniforce_workspace_suspended: 'This WSSO workspace is suspended. Contact support.',
  omniforce_seat_limit: 'Every seat in this WSSO workspace is in use. Ask your workspace admin to free one.',
  omniforce_workspace_failed: 'We could not create your WSSO workspace. Please try again.',
  omniforce_profile_failed: 'We could not create your WSSO account. Please try again.',
}

export const metadata: Metadata = { title: 'Sign In — WSSO' }

interface Props {
  searchParams: { error?: string; signup?: string }
}

export default function LoginPage({ searchParams }: Props) {
  const omniforce = omniforceSsoEnabled()
  const omniforceError = searchParams.error ? OMNIFORCE_ERRORS[searchParams.error] : undefined
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
          This workspace is suspended. Contact support.
        </div>
      )}

      {searchParams.error === 'no_workspace' && (
        <div className="mb-4 rounded-md border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Your account is not attached to a workspace. Contact support.
        </div>
      )}

      {searchParams.error === 'link_expired' && (
        <div className="mb-4 rounded-md border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Your reset link has expired or is invalid.{' '}
          <Link href="/forgot-password" className="font-medium underline">
            Request a new one
          </Link>
          .
        </div>
      )}

      {omniforceError && (
        <div className="mb-4 rounded-md border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          {omniforceError}
        </div>
      )}

      {omniforce && (
        <>
          <a
            href="/auth/omniforce/start"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Continue with Omni Force Vector
          </a>
          <div className="my-5 flex items-center gap-3 text-xs text-neutral-400" aria-hidden="true">
            <span className="h-px flex-1 bg-neutral-200" />or sign in with your WSSO password<span className="h-px flex-1 bg-neutral-200" />
          </div>
        </>
      )}

      <LoginForm />
    </>
  )
}
