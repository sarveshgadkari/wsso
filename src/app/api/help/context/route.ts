import { NextResponse } from 'next/server'
import { getOrganization, getProfile } from '@/lib/auth/session'
import { mergeWorkspaceSettings } from '@/lib/workspace/settings'
import {
  allowedPagesForRole,
  articlesForRole,
  matchPageArticle,
  toHelpRole,
  toPageContext,
} from '@/lib/help/scope'

export async function GET(request: Request) {
  const profile = await getProfile()
  if (!profile || profile.status === 'inactive') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = toHelpRole(profile.role)
  if (!role) {
    return NextResponse.json({ error: 'Help is not available for this account.' }, { status: 403 })
  }

  const url = new URL(request.url)
  const path = url.searchParams.get('path') || '/dashboard'

  const org = await getOrganization(profile.organization_id)
  const features = mergeWorkspaceSettings(org?.settings).features
  const allowed = articlesForRole(role, features)
  const current = matchPageArticle(path, role, allowed)

  return NextResponse.json({
    role,
    chatEnabled: true,
    page: current ? toPageContext(current) : null,
    allowedPages: allowedPagesForRole(role, features),
  })
}
