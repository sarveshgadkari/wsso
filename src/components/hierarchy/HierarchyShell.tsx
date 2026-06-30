'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { TeamsTable } from '@/components/teams/TeamsTable'
import { OrgAssignmentTable } from './OrgAssignmentTable'
import type { EmployeeOrgRow } from './OrgAssignmentDialog'
import type { Company, Profile } from '@/lib/types'
import type { TeamRow } from '@/components/teams/TeamDialog'

type Tab = 'org' | 'teams'

interface HierarchyShellProps {
  teams:     (TeamRow & { memberCount: number })[]
  companies: Pick<Company, 'id' | 'name' | 'code'>[]
  managers:  Pick<Profile, 'id' | 'full_name' | 'employee_code'>[]
  employees: EmployeeOrgRow[]
}

export function HierarchyShell({ teams, companies, managers, employees }: HierarchyShellProps) {
  const [tab, setTab] = useState<Tab>('org')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'org',   label: 'Org Assignment' },
    { id: 'teams', label: 'Teams' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex border-b border-neutral-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'org' && (
        <OrgAssignmentTable
          initialEmployees={employees}
          teams={teams}
          managers={managers}
          companies={companies}
        />
      )}

      {tab === 'teams' && (
        <TeamsTable
          initialTeams={teams}
          companies={companies}
          managers={managers}
        />
      )}
    </div>
  )
}
