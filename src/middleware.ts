import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Paths that do NOT require auth — everything else does.
const PUBLIC_PATHS = new Set(['/', '/login', '/forgot-password', '/reset-password'])
// Prefix-based public paths (e.g. /auth/callback, /auth/signout)
const PUBLIC_PREFIXES = ['/auth/', '/api/public/']

// Authenticated-but-any-role redirect targets for already-authed users on auth pages
const AUTH_ONLY_PATHS = new Set(['/login', '/forgot-password'])

// Paths that require role = 'admin'
const ADMIN_PREFIXES = ['/api/admin', '/admin', '/companies', '/settings']

// Paths that require role = 'admin' OR 'manager'
const MANAGER_ADMIN_PREFIXES = ['/employees', '/time/team', '/projects', '/clients', '/reports']

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

export async function middleware(request: NextRequest) {
  // ── Mutable response — must thread cookie mutations through ───────────────
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

  // IMPORTANT: always call getUser() first — it refreshes the session token
  // and writes updated cookies into supabaseResponse. Never short-circuit before this.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith('/api/')

  // ── 1. Unauthenticated access to protected routes → /login ─────────────────
  if (!isPublic(pathname) && !user) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── 2. Admin-only routes ────────────────────────────────────────────────────
  const isAdminRoute = ADMIN_PREFIXES.some((p) => pathname.startsWith(p))
  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return isApi
        ? NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 })
        : NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // ── 3. Manager-or-admin routes ─────────────────────────────────────────────
  const isManagerRoute = MANAGER_ADMIN_PREFIXES.some((p) => pathname.startsWith(p))
  if (isManagerRoute && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return isApi
        ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        : NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // ── 4. Redirect authenticated users away from login / forgot-password ──────
  if (user && AUTH_ONLY_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
