import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/signup',
  '/terms',
  '/privacy',
  '/refunds',
])
const PUBLIC_PREFIXES = ['/auth/', '/api/public/', '/api/mcp/', '/api/signup', '/api/billing/webhook', '/api/cron']

const AUTH_ONLY_PATHS = new Set(['/login', '/forgot-password', '/signup'])

const ADMIN_PREFIXES = ['/api/admin', '/admin', '/companies', '/settings', '/crm']
const MANAGER_ADMIN_PREFIXES = ['/employees', '/time/team', '/leave/team', '/projects', '/clients', '/reports', '/approvals', '/compliance']
const PLATFORM_PREFIXES = ['/platform', '/api/platform']

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (pathname.startsWith('/api/mcp/connection')) return false
  if (pathname === '/api/mcp') return true
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

function isPlatformPath(pathname: string): boolean {
  return PLATFORM_PREFIXES.some((p) => pathname.startsWith(p))
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith('/api/')

  if (!isPublic(pathname) && !user) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status, organization_id')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    if (role === 'super_admin') {
      if (AUTH_ONLY_PATHS.has(pathname)) {
        return NextResponse.redirect(new URL('/platform', request.url))
      }
      if (!isPlatformPath(pathname) && !isPublic(pathname) && !pathname.startsWith('/auth/')) {
        if (isApi && pathname.startsWith('/api/cron')) {
          return supabaseResponse
        }
        if (isApi) {
          return NextResponse.json({ error: 'Forbidden: Super Admin uses /platform' }, { status: 403 })
        }
        return NextResponse.redirect(new URL('/platform', request.url))
      }
      return supabaseResponse
    }

    if (isPlatformPath(pathname)) {
      return isApi
        ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        : NextResponse.redirect(new URL('/dashboard', request.url))
    }

    const isAdminRoute = ADMIN_PREFIXES.some((p) => pathname.startsWith(p))
    if (isAdminRoute && role !== 'admin') {
      return isApi
        ? NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 })
        : NextResponse.redirect(new URL('/dashboard', request.url))
    }

    const isManagerRoute = MANAGER_ADMIN_PREFIXES.some((p) => pathname.startsWith(p))
    if (isManagerRoute && (!role || !['admin', 'manager'].includes(role))) {
      return isApi
        ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        : NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (profile?.organization_id && role !== 'super_admin') {
      const { data: org } = await supabase
        .from('organizations')
        .select('status, trial_ends_at, current_period_end')
        .eq('id', profile.organization_id)
        .single()

      const paymentDue =
        org &&
        (org.status === 'past_due' ||
          (org.status === 'trial' && org.trial_ends_at && new Date(org.trial_ends_at) < new Date()) ||
          (org.status === 'active' && org.current_period_end && new Date(org.current_period_end) < new Date()))

      const allowedWhileLocked =
        pathname === '/dashboard' ||
        pathname.startsWith('/auth/') ||
        pathname.startsWith('/api/billing/') ||
        (role === 'admin' && (pathname === '/settings/billing' || pathname.startsWith('/settings/billing')))

      if (paymentDue && !allowedWhileLocked && !isPublic(pathname)) {
        if (isApi) {
          return NextResponse.json({ error: 'Subscription required' }, { status: 402 })
        }
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  if (user && AUTH_ONLY_PATHS.has(pathname)) {
    const dest = new URL('/dashboard', request.url)
    return NextResponse.redirect(dest)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
