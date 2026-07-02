// Hand-written to match the Phase 1 migration.
// Once you have a live Supabase project, replace this file by running:
//   npx supabase gen types typescript --project-id <ref> --schema public \
//     > src/lib/types/database.ts

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          employee_code: string
          full_name: string
          email: string
          phone: string | null
          role: Database['public']['Enums']['user_role']
          manager_id: string | null
          team_id: string | null
          department: string | null
          timezone: string
          status: Database['public']['Enums']['profile_status']
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          employee_code?: string        // auto-generated if omitted
          full_name: string
          email: string
          phone?: string | null
          role?: Database['public']['Enums']['user_role']
          manager_id?: string | null
          team_id?: string | null
          department?: string | null
          timezone?: string
          status?: Database['public']['Enums']['profile_status']
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          employee_code?: string
          full_name?: string
          email?: string
          phone?: string | null
          role?: Database['public']['Enums']['user_role']
          manager_id?: string | null
          team_id?: string | null
          department?: string | null
          timezone?: string
          status?: Database['public']['Enums']['profile_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_manager_id_fkey'
            columns: ['manager_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'profiles_team_id_fkey'
            columns: ['team_id']
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
        ]
      }

      companies: {
        Row: {
          id: string
          code: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          code?: string       // auto-generated (TLB001…)
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
        }
        Relationships: []
      }

      teams: {
        Row: {
          id: string
          code: string
          name: string
          company_id: string
          manager_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          company_id: string
          manager_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          company_id?: string
          manager_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'teams_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teams_manager_id_fkey'
            columns: ['manager_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      employee_companies: {
        Row: {
          employee_id: string
          company_id: string
        }
        Insert: {
          employee_id: string
          company_id: string
        }
        Update: {
          employee_id?: string
          company_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'employee_companies_employee_id_fkey'
            columns: ['employee_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'employee_companies_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }

      clients: {
        Row: {
          id: string
          code: string
          name: string
          contact_name: string | null
          contact_email: string | null
          contact_phone: string | null
          company_id: string
          status: Database['public']['Enums']['client_status']
          created_at: string
        }
        Insert: {
          id?: string
          code?: string     // auto-generated (CLI001…)
          name: string
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          company_id: string
          status?: Database['public']['Enums']['client_status']
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          company_id?: string
          status?: Database['public']['Enums']['client_status']
        }
        Relationships: [
          {
            foreignKeyName: 'clients_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }

      projects: {
        Row: {
          id: string
          code: string
          name: string
          company_id: string
          client_id: string | null
          manager_id: string | null
          status: Database['public']['Enums']['project_status']
          created_at: string
        }
        Insert: {
          id?: string
          code?: string     // auto-generated (PRJ001…)
          name: string
          company_id: string
          client_id?: string | null
          manager_id?: string | null
          status?: Database['public']['Enums']['project_status']
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          company_id?: string
          client_id?: string | null
          manager_id?: string | null
          status?: Database['public']['Enums']['project_status']
        }
        Relationships: [
          {
            foreignKeyName: 'projects_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'projects_client_id_fkey'
            columns: ['client_id']
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'projects_manager_id_fkey'
            columns: ['manager_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      tactics: {
        Row: {
          id: string
          code: string
          title: string
          description: string | null
          project_id: string | null
          assigned_to: string
          created_by: string
          priority: Database['public']['Enums']['tactic_priority']
          status: Database['public']['Enums']['tactic_status']
          due_date: string | null        // ISO date string
          estimated_hours: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code?: string     // auto-generated (TAC001…)
          title: string
          description?: string | null
          project_id?: string | null
          assigned_to: string
          created_by: string
          priority?: Database['public']['Enums']['tactic_priority']
          status?: Database['public']['Enums']['tactic_status']
          due_date?: string | null
          estimated_hours?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          title?: string
          description?: string | null
          project_id?: string | null
          assigned_to?: string
          created_by?: string
          priority?: Database['public']['Enums']['tactic_priority']
          status?: Database['public']['Enums']['tactic_status']
          due_date?: string | null
          estimated_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tactics_project_id_fkey'
            columns: ['project_id']
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tactics_assigned_to_fkey'
            columns: ['assigned_to']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tactics_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      activity_logs: {
        Row: {
          id: string
          tactic_id: string | null   // nullable: non-tactic events (e.g. force clock-out)
          employee_id: string
          action: string
          hours_logged: number | null
          notes: string | null
          meta: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          tactic_id?: string | null
          employee_id: string
          action: string
          hours_logged?: number | null
          notes?: string | null
          meta?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          tactic_id?: string | null
          employee_id?: string
          action?: string
          hours_logged?: number | null
          notes?: string | null
          meta?: Record<string, unknown> | null
        }
        Relationships: [
          {
            foreignKeyName: 'activity_logs_tactic_id_fkey'
            columns: ['tactic_id']
            referencedRelation: 'tactics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activity_logs_employee_id_fkey'
            columns: ['employee_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      time_logs: {
        Row: {
          id: string
          employee_id: string
          clock_in_at: string
          clock_out_at: string | null
          duration_minutes: number | null   // set by trigger
          closed_reason: Database['public']['Enums']['clock_close_reason'] | null
          auto_closed: boolean              // true when closed by system/admin, not by the employee
          log_date: string                  // set by trigger from clock_in_at
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          clock_in_at?: string
          clock_out_at?: string | null
          duration_minutes?: number | null  // normally omitted; trigger calculates it
          closed_reason?: Database['public']['Enums']['clock_close_reason'] | null
          auto_closed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          clock_in_at?: string
          clock_out_at?: string | null
          duration_minutes?: number | null
          closed_reason?: Database['public']['Enums']['clock_close_reason'] | null
          auto_closed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'time_logs_employee_id_fkey'
            columns: ['employee_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      documents: {
        Row: {
          id: string
          file_name: string
          file_path: string
          file_type: string | null
          file_size: number | null
          company_code: string | null
          employee_code: string | null
          client_code: string | null
          project_code: string | null
          tactic_code: string | null
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          file_name: string
          file_path: string
          file_type?: string | null
          file_size?: number | null
          company_code?: string | null
          employee_code?: string | null
          client_code?: string | null
          project_code?: string | null
          tactic_code?: string | null
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          file_name?: string
          file_path?: string
          file_type?: string | null
          file_size?: number | null
          company_code?: string | null
          employee_code?: string | null
          client_code?: string | null
          project_code?: string | null
          tactic_code?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'documents_uploaded_by_fkey'
            columns: ['uploaded_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          message: string
          link: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          message: string
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          message?: string
          link?: string | null
          is_read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      tactic_documents: {
        Row: {
          id: string
          code: string
          tactic_id: string | null          // optional link to a work order
          date_of_meeting: string | null    // ISO date
          time_of_meeting: string | null    // e.g. "6:00 PM IST"
          facilitator: string | null
          location: string | null
          attendees: string | null          // comma-separated names
          purpose: string
          background_info: string | null
          takeaways: string | null
          status: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'revision_needed'
          reviewer_id: string | null
          review_note: string | null
          submitted_at: string | null
          reviewed_at: string | null
          company_id: string | null
          project_id: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code?: string                     // auto-generated (TDOC001…)
          tactic_id?: string | null
          date_of_meeting?: string | null
          time_of_meeting?: string | null
          facilitator?: string | null
          location?: string | null
          attendees?: string | null
          purpose: string
          background_info?: string | null
          takeaways?: string | null
          status?: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'revision_needed'
          reviewer_id?: string | null
          review_note?: string | null
          submitted_at?: string | null
          reviewed_at?: string | null
          company_id?: string | null
          project_id?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          tactic_id?: string | null
          date_of_meeting?: string | null
          time_of_meeting?: string | null
          facilitator?: string | null
          location?: string | null
          attendees?: string | null
          purpose?: string
          background_info?: string | null
          takeaways?: string | null
          status?: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'revision_needed'
          reviewer_id?: string | null
          review_note?: string | null
          submitted_at?: string | null
          reviewed_at?: string | null
          company_id?: string | null
          project_id?: string | null
          created_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tactic_documents_tactic_id_fkey'
            columns: ['tactic_id']
            referencedRelation: 'tactics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tactic_documents_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tactic_documents_reviewer_id_fkey'
            columns: ['reviewer_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tactic_documents_company_id_fkey'
            columns: ['company_id']
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tactic_documents_project_id_fkey'
            columns: ['project_id']
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }

      tactic_tasks: {
        Row: {
          id: string
          tactic_document_id: string
          order_no: number
          title: string
          description: string
          assigned_to: string | null        // profile UUID for internal employee
          owner_name: string | null         // free-text for external owner
          status: 'pending' | 'in_progress' | 'completed'
          target_date: string | null        // ISO date
          created_at: string
        }
        Insert: {
          id?: string
          tactic_document_id: string
          order_no?: number
          title: string
          description?: string
          assigned_to?: string | null
          owner_name?: string | null
          status?: 'pending' | 'in_progress' | 'completed'
          target_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tactic_document_id?: string
          order_no?: number
          title?: string
          description?: string
          assigned_to?: string | null
          owner_name?: string | null
          status?: 'pending' | 'in_progress' | 'completed'
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'tactic_tasks_tactic_document_id_fkey'
            columns: ['tactic_document_id']
            referencedRelation: 'tactic_documents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tactic_tasks_assigned_to_fkey'
            columns: ['assigned_to']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      tactic_next_steps: {
        Row: {
          id: string
          tactic_document_id: string
          order_no: number
          description: string
          owner: string | null              // profile UUID
          owner_name: string | null         // free-text for external owner
          due_date: string | null           // ISO date
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tactic_document_id: string
          order_no?: number
          description: string
          owner?: string | null
          owner_name?: string | null
          due_date?: string | null
          completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tactic_document_id?: string
          order_no?: number
          description?: string
          owner?: string | null
          owner_name?: string | null
          due_date?: string | null
          completed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'tactic_next_steps_tactic_document_id_fkey'
            columns: ['tactic_document_id']
            referencedRelation: 'tactic_documents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tactic_next_steps_owner_fkey'
            columns: ['owner']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }

    Views: Record<string, never>

    Functions: {
      get_my_role: {
        Args: Record<PropertyKey, never>
        Returns: Database['public']['Enums']['user_role']
      }
      get_my_team_id: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
      get_my_employee_code: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
    }

    Enums: {
      user_role: 'admin' | 'director' | 'manager' | 'employee'
      profile_status: 'active' | 'inactive'
      project_status: 'active' | 'on_hold' | 'completed'
      tactic_priority: 'low' | 'medium' | 'high' | 'critical'
      tactic_status: 'assigned' | 'in_progress' | 'review' | 'done' | 'archived'
      client_status: 'active' | 'inactive'
      clock_close_reason: 'manual' | 'auto_logout' | 'admin_correction'
    }

    CompositeTypes: Record<string, never>
  }
}
