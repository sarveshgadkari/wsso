import type { Metadata } from 'next'
import { SignupForm } from '@/components/auth/SignupForm'
import { isSignupEnabled } from '@/lib/saas/plans'

export const metadata: Metadata = { title: 'Create workspace — WSSO' }

export default function SignupPage() {
  if (!isSignupEnabled()) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-semibold text-neutral-900">Signup is closed</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Contact us to get a workspace. If you already have one,{' '}
          <a href="/login" className="text-primary-600 hover:underline">sign in</a>.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">Start your workspace</h1>
        <p className="mt-1 text-sm text-neutral-500">14-day trial. You will be the workspace admin.</p>
      </div>
      <SignupForm />
    </>
  )
}
