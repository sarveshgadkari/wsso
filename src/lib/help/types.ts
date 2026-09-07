import type { UserRole } from '@/lib/types'
import type { WorkspaceFeatureKey } from '@/lib/workspace/settings'

export type HelpRole = Exclude<UserRole, 'super_admin'>

export type HelpArticle = {
  id: string
  path: string
  title: string
  /** If set, only these roles receive this article. Omit = every workspace role. */
  roles?: HelpRole[]
  feature?: WorkspaceFeatureKey
  /** Included in every chat context for that role, never used as a page match. */
  alwaysInContext?: boolean
  summary: string
  youAreHere: string
  steps: string[]
  tips?: string[]
  suggestedQuestions: string[]
  body: string
}

export type HelpPageContext = {
  id: string
  title: string
  summary: string
  youAreHere: string
  steps: string[]
  tips: string[]
  suggestedQuestions: string[]
}

export type HelpAllowedPage = {
  path: string
  title: string
}
