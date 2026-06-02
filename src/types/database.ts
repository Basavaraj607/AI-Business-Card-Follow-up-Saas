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
          full_name: string | null
          avatar_url: string | null
          role: 'owner' | 'admin' | 'member'
          email: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
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
          // Card metadata
          card_image_url: string | null
          card_image_path: string | null
          // OCR + AI
          raw_ocr_text: string | null
          ai_structured: Json | null
          ai_notes: string | null
          // Relationship
          lead_status: LeadStatus
          lead_score: number | null
          // Context (where/when met)
          met_at_event: string | null
          met_at_date: string | null
          met_at_location: string | null
          context_notes: string | null
          // State
          last_contacted_at: string | null
          next_followup_at: string | null
          tags: string[]
          is_archived: boolean
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
