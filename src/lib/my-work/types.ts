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
  /** @deprecated legacy block-based page content — superseded by doc_html */
  blocks:          DocBlock[]
  doc_html:        string | null
  source_filename: string | null
  folder_id:       string | null
  created_at:      string
  updated_at:      string
}

export interface WorkSheetFolder {
  id:          string
  employee_id: string
  name:        string
  created_at:  string
  updated_at:  string
}

export interface WorkSheetFolderAccess {
  isOwner:    boolean
  canEdit:    boolean
  ownerName?: string | null
}

export type WorkSheetFolderWithAccess = WorkSheetFolder & { access: WorkSheetFolderAccess }

export interface WorkSheetFolderShare {
  id:          string
  folder_id:   string
  shared_with: string
  can_edit:    boolean
  created_at:  string
  user:        ShareableUser
}

export interface WorkSheetAccess {
  isOwner:      boolean
  canEdit:      boolean
  ownerName?:   string | null
  shareCount?:  number
  viaFolder?:   string | null
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
