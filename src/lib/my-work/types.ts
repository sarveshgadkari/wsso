/** One row in a personal work sheet grid */
export interface WorkSheetRow {
  id:         string
  cells:      Record<string, string>
  tactic_id?: string | null
}

export type DocBlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet'
  | 'numbered'
  | 'todo'
  | 'divider'

export interface DocBlock {
  id:      string
  type:    DocBlockType
  text:    string
  checked?: boolean
}

export type WorkSheetType = 'spreadsheet' | 'document'

export interface WorkSheet {
  id:              string
  employee_id:     string
  name:            string
  sheet_type:      WorkSheetType
  columns:         string[]
  rows:            WorkSheetRow[]
  blocks:          DocBlock[]
  source_filename: string | null
  created_at:      string
  updated_at:      string
}

export interface WorkSheetAccess {
  isOwner:     boolean
  canEdit:     boolean
  ownerName?:  string | null
  shareCount?: number
}

export type WorkSheetWithAccess = WorkSheet & { access: WorkSheetAccess }

export interface ShareableUser {
  id:            string
  full_name:     string
  employee_code: string
  role:          string
}

export interface WorkSheetShare {
  id:          string
  sheet_id:    string
  shared_with: string
  can_edit:    boolean
  created_at:  string
  user:        ShareableUser
}

export interface WorkOrderOption {
  id:     string
  code:   string
  title:  string
  status: string
}

export const DEFAULT_DOCUMENT_BLOCKS: DocBlock[] = [
  { id: 'b1', type: 'heading1', text: '' },
  { id: 'b2', type: 'paragraph', text: '' },
]
