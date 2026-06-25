// ── Auto-generated Supabase DB types ─────────────────
// Run: npx supabase gen types typescript --project-id YOUR_ID > src/types/database.ts
// This file is the manual equivalent for Day 1.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type LeadStatus = 'hot' | 'warm' | 'cold' | 'converted' | 'dead'
export type MessageChannel = 'email' | 'whatsapp' | 'sms' | 'linkedin'
export type MessageStatus = 'draft' | 'scheduled' | 'sent' | 'delivered' | 'failed' | 'replied'
export type FollowupStatus = 'pending' | 'sent' | 'skipped' | 'done'

export interface Database {
  public: {
    Tables: {

      // ── tenants ───────────────────────────────────────
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          plan: 'free' | 'pro' | 'team' | 'enterprise'
          owner_id: string
          settings: Json
          is_suspended: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>
      }

      // ── profiles ──────────────────────────────────────
      profiles: {
        Row: {
          id: string
          tenant_id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: 'owner' | 'admin' | 'member'
          user_type: 'user' | 'admin' | 'superadmin'
          sender_name: string | null
          sender_phone: string | null
          email_signature: string | null
          mfa_enabled: boolean
          mfa_secret: string | null
          is_suspended: boolean
          suspended_at: string | null
          suspended_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }

      // ── user_registrations ────────────────────────────
      user_registrations: {
        Row: {
          id: string
          first_name: string
          last_name: string
          email: string
          mobile_number: string | null
          company_name: string | null
          job_title: string | null
          country: string | null
          industry: string | null
          consent_given: boolean
          consent_given_at: string | null
          is_active: boolean
          is_verified: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_registrations']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['user_registrations']['Insert']>
      }

      // ── admin_registrations ───────────────────────────
      admin_registrations: {
        Row: {
          id: string
          full_name: string
          email: string
          mobile_number: string
          company_name: string
          admin_level: 'super' | 'limited'
          designation: string | null
          department: string | null
          backup_contact: string | null
          mfa_enabled: boolean
          mfa_verified_at: string | null
          consent_given: boolean
          consent_given_at: string | null
          is_active: boolean
          is_suspended: boolean
          suspended_reason: string | null
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['admin_registrations']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['admin_registrations']['Insert']>
      }

      // ── companies ─────────────────────────────────────
      companies: {
        Row: {
          id: string
          tenant_id: string
          name: string
          domain: string | null
          industry: string | null
          website: string | null
          linkedin_url: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['companies']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['companies']['Insert']>
      }

      // ── contacts ──────────────────────────────────────
      contacts: {
        Row: {
          id: string
          tenant_id: string
          created_by: string
          owner_id: string | null
          company_id: string | null
          // Core info
          full_name: string
          email: string | null
          phone: string | null
          role: string | null
          department: string | null
          // Social
          linkedin_url: string | null
          twitter_handle: string | null
          // Source Tracking
          source: string
          // Card metadata
          card_image_url: string | null
          card_image_path: string | null
          // OCR + AI
          raw_ocr_text: string | null
          ai_structured: Json | null
          ai_notes: string | null
          last_interaction_summary: string | null
          // Lead intelligence
          lead_status: LeadStatus
          lead_score: number | null
          opportunity_type: string | null
          relationship_stage: string
          // Context (where/when met)
          met_at_event: string | null
          met_at_date: string | null
          met_at_location: string | null
          context_notes: string | null
          // Stats
          email_count: number
          whatsapp_count: number
          sms_count: number
          linkedin_count: number
          // Follow-up
          followup_status: string | null
          last_contacted_at: string | null
          next_followup_at: string | null
          tags: string[]
          // Duplicate / Security / Search
          contact_hash: string | null
          is_archived: boolean
          search_vector: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['contacts']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>
      }

      // ── messages ──────────────────────────────────────
      messages: {
        Row: {
          id: string
          tenant_id: string
          contact_id: string
          sent_by: string
          channel: MessageChannel
          status: MessageStatus
          subject: string | null
          body: string
          ai_generated: boolean
          scheduled_for: string | null
          sent_at: string | null
          opened_at: string | null
          replied_at: string | null
          external_id: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['messages']['Insert']>
      }

      // ── followups ─────────────────────────────────────
      followups: {
        Row: {
          id: string
          tenant_id: string
          contact_id: string
          assigned_to: string
          status: FollowupStatus
          channel: MessageChannel
          due_at: string
          message_draft: string | null
          subject_draft: string | null
          ai_suggestion: string | null
          completed_at: string | null
          notes: string | null
          step_number: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['followups']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['followups']['Insert']>
      }

      // ── platform_settings ─────────────────────────────
      platform_settings: {
        Row: {
          id: string
          maintenance_mode: boolean
          max_contacts_limit: number
          max_messages_limit: number
          default_resend_key: string
          default_twilio_sid: string
          default_twilio_token: string
          default_twilio_phone: string
          default_meta_token: string
          default_meta_phone_id: string
          feature_flags: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['platform_settings']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['platform_settings']['Insert']>
      }

      // ── audit_logs ────────────────────────────────────
      audit_logs: {
        Row: {
          id: string
          performed_by: string
          action: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'suspend' | 'impersonate' | 'export'
          target_type: string | null
          target_id: string | null
          target_tenant: string | null
          metadata: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>
      }

    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      lead_status: LeadStatus
      message_channel: MessageChannel
      message_status: MessageStatus
      followup_status: FollowupStatus
    }
  }
}

// ── Convenience row types ─────────────────────────────
export type Tenant   = Database['public']['Tables']['tenants']['Row']
export type Profile  = Database['public']['Tables']['profiles']['Row']
export type Company  = Database['public']['Tables']['companies']['Row']
export type Contact  = Database['public']['Tables']['contacts']['Row']
export type Message  = Database['public']['Tables']['messages']['Row']
export type Followup = Database['public']['Tables']['followups']['Row']
export type PlatformSettings = Database['public']['Tables']['platform_settings']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
