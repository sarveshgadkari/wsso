import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function BrandLogo({
  size = 40,
  withWordmark = false,
  href,
  className,
  priority = false,
}: {
  size?: number
  withWordmark?: boolean
  href?: string | null
  className?: string
  priority?: boolean
}) {
  const mark = (
    <span className={cn('inline-flex items-center gap-2 min-w-0', className)}>
      <Image
        src="/brand/wsso-logo.png"
        alt="WSSO — Work Management System"
        width={size}
        height={size}
        className="h-auto w-auto object-contain"
        style={{ height: size, width: 'auto' }}
        priority={priority}
      />
      {withWordmark && (
        <span className="truncate text-sm font-semibold tracking-tight text-primary-800">WSSO</span>
      )}
    </span>
  )

  if (href === null) return mark
  return (
    <Link href={href ?? '/'} className="inline-flex items-center" aria-label="WSSO home">
      {mark}
    </Link>
  )
}
