import type { HelpArticle, HelpRole } from './types'
import { allowedPagesForRole } from './scope'
import { HELP_FAQS, type HelpFaq } from './faqs'
import type { WorkspaceFeatures } from '@/lib/workspace/settings'

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'is', 'it', 'my', 'me',
  'do', 'i', 'how', 'what', 'where', 'when', 'why', 'can', 'please', 'just', 'this',
  'that', 'with', 'from', 'about', 'you', 'your', 'we', 'our', 'be', 'at', 'as',
  'does', 'did', 'are', 'was', 'will', 'would', 'could', 'should', 'there',
])

const GREET = /^(hi|hello|hey|yo|hola|namaste|good (morning|afternoon|evening))\b/i
const WHERE = /\b(where am i|what( is|'s)? this( page| tab| screen)?|what do i do here|help me( here)?|explain this page|tour)\b/i

const WSSO_HINT = /\b(wsso|clock|timesheet|leave|vacation|work ?order|tactic|kanban|dashboard|employee|lead|crm|billing|subscription|training|sticky|announcement|report|project|client|company|sidebar|shift|hours|overtime|approve|manager|admin|mic|help)\b/i

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP.has(t))
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function expand(queryTokens: string[]): Set<string> {
  const extra: Record<string, string[]> = {
    clock: ['time', 'timesheet', 'hours', 'punch'],
    punch: ['clock', 'time'],
    timesheet: ['time', 'hours', 'clock'],
    hours: ['time', 'timesheet'],
    vacation: ['leave'],
    pto: ['leave'],
    off: ['leave'],
    timeoff: ['leave'],
    approve: ['approvals', 'leave', 'team'],
    approval: ['approvals'],
    job: ['work', 'orders', 'tactics'],
    jobs: ['work', 'orders', 'tactics'],
    tactic: ['work', 'orders', 'tactics'],
    tactics: ['work', 'orders'],
    billing: ['subscription', 'plan', 'stripe', 'pay'],
    subscription: ['billing', 'plan'],
    pay: ['billing', 'subscription'],
    invite: ['employees', 'employee'],
    people: ['employees'],
    staff: ['employees'],
    settings: ['workspace'],
    feature: ['workspace'],
    lead: ['leads', 'crm'],
    leads: ['crm'],
    license: ['licenses', 'compliance'],
    certificate: ['licenses', 'compliance'],
    note: ['sticky', 'notes'],
    sticky: ['notes'],
    training: ['module', 'quiz'],
    report: ['reports'],
    payroll: ['reports', 'time'],
    kanban: ['board', 'work', 'orders'],
    board: ['kanban'],
    client: ['clients'],
    project: ['projects'],
    company: ['companies'],
    password: ['login', 'reset'],
    login: ['password', 'sign'],
  }
  const out = new Set(queryTokens)
  for (const t of queryTokens) {
    extra[t]?.forEach((x) => out.add(x))
  }
  return out
}

function articleText(article: HelpArticle): string {
  return [
    article.title,
    article.summary,
    article.youAreHere,
    article.body,
    ...(article.steps ?? []),
    ...(article.tips ?? []),
    ...(article.suggestedQuestions ?? []),
  ].join(' ')
}

function scoreArticle(article: HelpArticle, query: Set<string>, isCurrent: boolean): number {
  const bag = tokens(articleText(article))
  const title = new Set(tokens(article.title))
  const questions = tokens(article.suggestedQuestions.join(' '))
  let score = 0
  for (const t of Array.from(query)) {
    if (title.has(t)) score += 6
    if (questions.includes(t)) score += 3
    score += bag.filter((w) => w === t).length
  }
  if (isCurrent) score += 4
  if (article.alwaysInContext) score -= 2
  return score
}

function scoreFaq(faq: HelpFaq, raw: string, query: Set<string>): number {
  const qn = normalize(raw)
  let best = 0
  for (const question of faq.questions) {
    const n = normalize(question)
    if (qn === n) return 100
    if (qn.length > 8 && (n.includes(qn) || qn.includes(n))) best = Math.max(best, 72)
    const qt = tokens(question)
    if (qt.length === 0) continue
    let hit = 0
    for (const t of qt) {
      if (query.has(t)) hit += 1
    }
    const overlap = hit / qt.length
    best = Math.max(best, overlap * 50 + hit * 4)
  }
  return best
}

function ordinal(i: number): string {
  return ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'][i] ?? 'Next'
}

function speakArticle(article: HelpArticle): string {
  const steps = article.steps.map((s, i) => `${ordinal(i)}, ${s.replace(/\.$/, '')}.`).join(' ')
  const tip = article.tips?.[0] ? ` Tip: ${article.tips[0]}` : ''
  return `${article.youAreHere} ${article.summary} ${steps}${tip}`.replace(/\s+/g, ' ').trim()
}

function faqsFor(allowed: HelpArticle[]): HelpFaq[] {
  const ids = new Set(allowed.map((a) => a.id))
  return HELP_FAQS.filter((f) => ids.has(f.articleId))
}

export function exampleQuestions(allowed: HelpArticle[], current: HelpArticle | null, limit = 5): string[] {
  const faqs = faqsFor(allowed)
  const preferred = current ? faqs.filter((f) => f.articleId === current.id) : []
  const rest = faqs.filter((f) => f.articleId !== current?.id)
  const out: string[] = []
  const seen = new Set<string>()
  for (const faq of [...preferred, ...rest]) {
    const q = faq.questions[0]
    if (!q || seen.has(q)) continue
    seen.add(q)
    out.push(q)
    if (out.length >= limit) break
  }
  return out
}

function pageNames(role: HelpRole, features: WorkspaceFeatures): string {
  const pages = allowedPagesForRole(role, features).map((p) => p.title)
  if (pages.length <= 4) return pages.join(', ')
  return `${pages.slice(0, 4).join(', ')}, and other pages in your sidebar`
}

function refuse(role: HelpRole, features: WorkspaceFeatures, current: HelpArticle | null, allowed: HelpArticle[]): string {
  const scope = pageNames(role, features)
  const examples = exampleQuestions(allowed, current, 3).join(' ')
  const here = current ? ` You are on ${current.title}.` : ''
  if (role === 'employee' || role === 'director') {
    return `That is an admin or manager feature, so I cannot explain it. I only help with your WSSO pages: ${scope}.${here} Try asking: ${examples}`
  }
  if (role === 'manager') {
    return `That setting is admin-only. I can help with your team pages: ${scope}.${here} Try: ${examples}`
  }
  return `I only answer WSSO help questions. Try ${scope}.${here}`
}

function unknownReply(opts: {
  raw: string
  role: HelpRole
  current: HelpArticle | null
  allowed: HelpArticle[]
}): string {
  const examples = exampleQuestions(opts.allowed, opts.current, 4)
  const sample = examples.length ? ` Try asking: ${examples.join(' ')}` : ''
  const here = opts.current ? ` You are on ${opts.current.title}. You can also say, what is this page?` : ''

  if (!WSSO_HINT.test(opts.raw) && tokens(opts.raw).length >= 2) {
    return `I am the WSSO help agent. I only answer questions about this app for your ${opts.role} account. I cannot help with topics outside WSSO.${sample}${here}`
  }

  return `I do not have that exact question in the WSSO help list.${sample}${here} If you need something the screens cannot do, ask your manager or workspace admin.`
}

export function answerHelpQuestion(opts: {
  message: string
  role: HelpRole
  features: WorkspaceFeatures
  current: HelpArticle | null
  allowed: HelpArticle[]
}): string {
  const raw = opts.message.trim()
  if (!raw) return 'Ask a question about this WSSO page, or tap the mic.'

  if (GREET.test(raw) && raw.length < 40) {
    const here = opts.current
      ? `You are on ${opts.current.title}. ${opts.current.youAreHere}`
      : 'You are in WSSO help.'
    const examples = exampleQuestions(opts.allowed, opts.current, 3)
    return `${here} Speak or type a WSSO question. I only explain screens your ${opts.role} account can open.${examples.length ? ` For example: ${examples.join(' ')}` : ''}`
  }

  if (WHERE.test(raw) && opts.current) {
    return speakArticle(opts.current)
  }

  if (
    (opts.role === 'employee' || opts.role === 'director') &&
    /\b(billing|subscription|stripe|workspace settings|add (a )?company|payroll|approve (leave|time)|team time|force clock|invite (an? )?(employee|user))\b/i.test(raw)
  ) {
    return refuse(opts.role, opts.features, opts.current, opts.allowed)
  }
  if (
    opts.role === 'manager' &&
    /\b(billing|subscription|stripe|workspace settings|add (a )?company)\b/i.test(raw)
  ) {
    return refuse(opts.role, opts.features, opts.current, opts.allowed)
  }

  const query = expand(tokens(raw))
  if (query.size === 0 && opts.current) return speakArticle(opts.current)

  const allowedFaqs = faqsFor(opts.allowed)
  let bestFaq: HelpFaq | null = null
  let bestFaqScore = 0
  for (const faq of allowedFaqs) {
    const s = scoreFaq(faq, raw, query)
    if (s > bestFaqScore) {
      bestFaqScore = s
      bestFaq = faq
    }
  }
  if (bestFaq && bestFaqScore >= 28) {
    return bestFaq.answer
  }

  let best: HelpArticle | null = null
  let bestScore = 0
  for (const article of opts.allowed) {
    const s = scoreArticle(article, query, article.id === opts.current?.id)
    if (s > bestScore) {
      bestScore = s
      best = article
    }
  }

  const threshold = Math.max(6, Math.min(9, query.size + 3))
  if (best && bestScore >= threshold) {
    return speakArticle(best)
  }

  return unknownReply({ raw, role: opts.role, current: opts.current, allowed: opts.allowed })
}
