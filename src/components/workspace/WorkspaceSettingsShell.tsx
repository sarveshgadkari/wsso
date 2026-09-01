'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { HierarchyShell } from '@/components/hierarchy/HierarchyShell'
import type { EmployeeOrgRow } from '@/components/hierarchy/OrgAssignmentDialog'
import type { Company, Profile } from '@/lib/types'
import type { TeamRow } from '@/components/teams/TeamDialog'
import type { WorkspaceSettings } from '@/lib/workspace/settings'
import type {
  ChecklistTemplate,
  CustomFieldDefinition,
  OrgCatalogItem,
  OrgHoliday,
  OrgLocation,
  RecurringJob,
} from '@/lib/workspace/rows'
import { FeaturesPanel } from './FeaturesPanel'
import { RulesPanel } from './RulesPanel'
import { CatalogPanel } from './CatalogPanel'
import { LocationsHolidaysPanel } from './LocationsHolidaysPanel'
import { CustomFieldsPanel } from './CustomFieldsPanel'
import { ChecklistsPanel } from './ChecklistsPanel'
import { RatesSkillsPanel } from './RatesSkillsPanel'
import { RecurringJobsPanel } from './RecurringJobsPanel'

type Tab =
  | 'people'
  | 'features'
  | 'rules'
  | 'lists'
  | 'places'
  | 'fields'
  | 'checklists'
  | 'rates'
  | 'recurring'

const TABS: { id: Tab; label: string }[] = [
  { id: 'people', label: 'People' },
  { id: 'features', label: 'Features' },
  { id: 'rules', label: 'Work rules' },
  { id: 'lists', label: 'Lists' },
  { id: 'places', label: 'Locations' },
  { id: 'fields', label: 'Custom fields' },
  { id: 'checklists', label: 'Checklists' },
  { id: 'rates', label: 'Pay & skills' },
  { id: 'recurring', label: 'Recurring jobs' },
]

export type WorkspacePageData = {
  settings: WorkspaceSettings
  teams: (TeamRow & { memberCount: number })[]
  companies: Pick<Company, 'id' | 'name' | 'code'>[]
  managers: Pick<Profile, 'id' | 'full_name' | 'employee_code'>[]
  employees: EmployeeOrgRow[]
  catalog: OrgCatalogItem[]
  locations: OrgLocation[]
  holidays: OrgHoliday[]
  fields: CustomFieldDefinition[]
  checklists: ChecklistTemplate[]
  skillsByEmployee: Record<string, string[]>
  projects: { id: string; name: string; code: string }[]
  recurring: RecurringJob[]
  sqlReady: boolean
}

export function WorkspaceSettingsShell({ data }: { data: WorkspacePageData }) {
  const [tab, setTab] = useState<Tab>('features')

  return (
    <div className="flex flex-col gap-4">
      {!data.sqlReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Run <code className="font-mono">saas/09_workspace_ops.sql</code> in the Supabase SQL Editor
          to enable lists, locations, checklists, and compliance. Feature toggles still save on the workspace.
        </div>
      )}

      <div className="flex flex-wrap border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'people' && (
        <HierarchyShell
          teams={data.teams}
          companies={data.companies}
          managers={data.managers}
          employees={data.employees}
        />
      )}
      {tab === 'features' && <FeaturesPanel settings={data.settings} />}
      {tab === 'rules' && <RulesPanel settings={data.settings} />}
      {tab === 'lists' && <CatalogPanel items={data.catalog} />}
      {tab === 'places' && <LocationsHolidaysPanel locations={data.locations} holidays={data.holidays} />}
      {tab === 'fields' && <CustomFieldsPanel fields={data.fields} />}
      {tab === 'checklists' && <ChecklistsPanel templates={data.checklists} />}
      {tab === 'rates' && (
        <RatesSkillsPanel
          employees={data.employees}
          locations={data.locations}
          managers={data.managers}
          skills={data.catalog.filter((c) => c.kind === 'skill' && c.is_active)}
          skillsByEmployee={data.skillsByEmployee}
        />
      )}
      {tab === 'recurring' && (
        <RecurringJobsPanel
          jobs={data.recurring}
          employees={data.employees}
          projects={data.projects}
          checklists={data.checklists.filter((c) => c.is_active)}
          jobTypes={data.catalog.filter((c) => c.kind === 'work_order_type' && c.is_active)}
        />
      )}
    </div>
  )
}
