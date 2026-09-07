import { HELP_ARTICLES } from './articles'
import { questionsForArticle } from './faqs'
import type { HelpAllowedPage, HelpArticle, HelpPageContext, HelpRole } from './types'
import type { UserRole } from '@/lib/types'
import type { WorkspaceFeatures } from '@/lib/workspace/settings'

export function toHelpRole(role: UserRole): HelpRole | null {
  if (role === 'super_admin') return null
  if (role === 'admin' || role === 'director' || role === 'manager' || role === 'employee') {
    return role
  }
  return null
}

export function isArticleAllowed(
  article: HelpArticle,
  role: HelpRole,
  features: WorkspaceFeatures,
): boolean {
  if (article.roles && article.roles.length > 0 && !article.roles.includes(role)) return false
  if (article.feature && !features[article.feature]) return false
  return true
}

export function articlesForRole(role: HelpRole, features: WorkspaceFeatures): HelpArticle[] {
  return HELP_ARTICLES.filter((article) => isArticleAllowed(article, role, features))
}

export function normalizeHelpPath(path: string): string {
  const raw = (path || '/dashboard').trim()
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  const noQuery = withSlash.split('?')[0].split('#')[0]
  if (noQuery.length > 1 && noQuery.endsWith('/')) return noQuery.slice(0, -1)
  return noQuery || '/dashboard'
}

export function matchPageArticle(
  pathname: string,
  role: HelpRole,
  allowed: HelpArticle[],
): HelpArticle | null {
  const path = normalizeHelpPath(pathname)
  const pageArticles = allowed.filter((a) => !a.alwaysInContext && a.path)
  const matches = pageArticles.filter((a) => path === a.path || path.startsWith(`${a.path}/`))
  matches.sort((a, b) => b.path.length - a.path.length)
  if (matches.length === 0) return null

  const longest = matches[0].path
  const samePath = matches.filter((a) => a.path === longest)
  if (samePath.length === 1) return samePath[0]

  const forRole = samePath.find((a) => a.roles?.includes(role))
  return forRole ?? samePath.find((a) => !a.roles) ?? samePath[0]
}

export function toPageContext(article: HelpArticle): HelpPageContext {
  return {
    id: article.id,
    title: article.title,
    summary: article.summary,
    youAreHere: article.youAreHere,
    steps: article.steps,
    tips: article.tips ?? [],
    suggestedQuestions: questionsForArticle(article),
  }
}

export function allowedPagesForRole(role: HelpRole, features: WorkspaceFeatures): HelpAllowedPage[] {
  const seen = new Set<string>()
  const pages: HelpAllowedPage[] = []
  for (const article of articlesForRole(role, features)) {
    if (article.alwaysInContext || !article.path) continue
    if (seen.has(article.path)) continue
    seen.add(article.path)
    pages.push({ path: article.path, title: article.title })
  }
  return pages
}

export function buildChatKnowledge(
  role: HelpRole,
  features: WorkspaceFeatures,
  pathname: string,
): { current: HelpArticle | null; allowed: HelpArticle[] } {
  const allowed = articlesForRole(role, features)
  const current = matchPageArticle(pathname, role, allowed)
  return { current, allowed }
}
