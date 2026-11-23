export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          agency_id: string
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          agency_id: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          agency_id?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          country_code: string
          created_at: string
          currency_code: string
          email: string | null
          id: string
          legal_name: string | null
          logo_path: string | null
          name: string
          phone: string | null
          registration_number: string | null
          slug: string
          status: string
          suspended_at: string | null
          timezone: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          country_code?: string
          created_at?: string
          currency_code?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_path?: string | null
          name: string
          phone?: string | null
          registration_number?: string | null
          slug: string
          status?: string
          suspended_at?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          country_code?: string
          created_at?: string
          currency_code?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_path?: string | null
          name?: string
          phone?: string | null
          registration_number?: string | null
          slug?: string
          status?: string
          suspended_at?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      agency_applications: {
        Row: {
          agency_id: string | null
          agency_name: string
          applicant_user_id: string
          contact_name: string
          country_code: string
          created_at: string
          email: string
          id: string
          legal_name: string | null
          phone: string
          registration_number: string | null
          requested_plan_code: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          agency_name: string
          applicant_user_id: string
          contact_name: string
          country_code?: string
          created_at?: string
          email: string
          id?: string
          legal_name?: string | null
          phone: string
          registration_number?: string | null
          requested_plan_code?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          agency_name?: string
          applicant_user_id?: string
          contact_name?: string
          country_code?: string
          created_at?: string
          email?: string
          id?: string
          legal_name?: string | null
          phone?: string
          registration_number?: string | null
          requested_plan_code?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_applications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_entitlements: {
        Row: {
          agency_id: string
          enabled: boolean
          feature_code: string
          limit_value: number | null
          source: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          enabled?: boolean
          feature_code: string
          limit_value?: number | null
          source?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          enabled?: boolean
          feature_code?: string
          limit_value?: number | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_entitlements_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_deletion_requests: {
        Row: {
          agency_id: string | null
          agency_name_snapshot: string
          agency_slug_snapshot: string
          completed_at: string | null
          id: string
          processing_error: string | null
          reason: string
          requester_email_snapshot: string | null
          requested_at: string
          requested_by: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          agency_name_snapshot: string
          agency_slug_snapshot: string
          completed_at?: string | null
          id?: string
          processing_error?: string | null
          reason?: string
          requester_email_snapshot?: string | null
          requested_at?: string
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          agency_name_snapshot?: string
          agency_slug_snapshot?: string
          completed_at?: string | null
          id?: string
          processing_error?: string | null
          reason?: string
          requester_email_snapshot?: string | null
          requested_at?: string
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_deletion_requests_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_integrations: {
        Row: {
          agency_id: string
          configuration: Json
          connected_at: string | null
          created_at: string
          id: string
          provider: string
          secret_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          configuration?: Json
          connected_at?: string | null
          created_at?: string
          id?: string
          provider: string
          secret_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          configuration?: Json
          connected_at?: string | null
          created_at?: string
          id?: string
          provider?: string
          secret_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_integrations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          agency_id: string
          created_at: string
          expires_at: string
          id: string
          invited_by_membership_id: string
          invited_email: string
          role_id: string
          status: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          agency_id: string
          created_at?: string
          expires_at: string
          id?: string
          invited_by_membership_id: string
          invited_email: string
          role_id: string
          status?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          agency_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invited_by_membership_id?: string
          invited_email?: string
          role_id?: string
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_invitations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_invitations_invited_by_membership_id_fkey"
            columns: ["invited_by_membership_id"]
            isOneToOne: false
            referencedRelation: "agency_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_memberships: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          is_owner: boolean
          joined_at: string | null
          role_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          is_owner?: boolean
          joined_at?: string | null
          role_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          is_owner?: boolean
          joined_at?: string | null
          role_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_memberships_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_notes: {
        Row: {
          agency_id: string
          body: string
          category: string | null
          completed: boolean
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          priority: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency_id: string
          body?: string
          category?: string | null
          completed?: boolean
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency_id?: string
          body?: string
          category?: string | null
          completed?: boolean
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_notes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_website_connections: {
        Row: {
          agency_id: string
          allowed_origin: string
          created_at: string
          created_by: string | null
          id: string
          last_rotated_at: string
          status: string
          token_hash: string
          token_last_four: string
          updated_at: string
          website_url: string
        }
        Insert: {
          agency_id: string
          allowed_origin: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_rotated_at?: string
          status?: string
          token_hash: string
          token_last_four: string
          updated_at?: string
          website_url: string
        }
        Update: {
          agency_id?: string
          allowed_origin?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_rotated_at?: string
          status?: string
          token_hash?: string
          token_last_four?: string
          updated_at?: string
          website_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_website_connections_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          agency_id: string
          booking_date: string
          booking_ref: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          customer_id: string | null
          departure_date: string | null
          id: string
          lead_id: string | null
          metadata: Json
          notes: string | null
          package_id: string | null
          return_date: string | null
          status: string
          total_amount_minor: number
          traveller_count: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          booking_date?: string
          booking_ref?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          customer_id?: string | null
          departure_date?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          notes?: string | null
          package_id?: string | null
          return_date?: string | null
          status?: string
          total_amount_minor?: number
          traveller_count?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          booking_date?: string
          booking_ref?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          customer_id?: string | null
          departure_date?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          notes?: string | null
          package_id?: string | null
          return_date?: string | null
          status?: string
          total_amount_minor?: number
          traveller_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_agency_id_customer_id_fkey"
            columns: ["agency_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "bookings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_agency_id_lead_id_fkey"
            columns: ["agency_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "bookings_agency_id_package_id_fkey"
            columns: ["agency_id", "package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          agency_id: string
          created_at: string
          created_by: string | null
          customer_ref: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string
          id: string
          metadata: Json
          nationality: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          agency_id: string
          created_at?: string
          created_by?: string | null
          customer_ref?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          id?: string
          metadata?: Json
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          agency_id?: string
          created_at?: string
          created_by?: string | null
          customer_ref?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          id?: string
          metadata?: Json
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          agency_id: string
          booking_id: string | null
          created_at: string
          customer_id: string | null
          document_type: string
          external_url: string | null
          file_name: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          ocr_result: Json
          ocr_status: string
          payment_id: string | null
          storage_path: string | null
          traveller_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          agency_id: string
          booking_id?: string | null
          created_at?: string
          customer_id?: string | null
          document_type: string
          external_url?: string | null
          file_name: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          ocr_result?: Json
          ocr_status?: string
          payment_id?: string | null
          storage_path?: string | null
          traveller_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          agency_id?: string
          booking_id?: string | null
          created_at?: string
          customer_id?: string | null
          document_type?: string
          external_url?: string | null
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          ocr_result?: Json
          ocr_status?: string
          payment_id?: string | null
          storage_path?: string | null
          traveller_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_agency_id_booking_id_fkey"
            columns: ["agency_id", "booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "documents_agency_id_customer_id_fkey"
            columns: ["agency_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "documents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_agency_id_payment_id_fkey"
            columns: ["agency_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "documents_agency_id_traveller_id_fkey"
            columns: ["agency_id", "traveller_id"]
            isOneToOne: false
            referencedRelation: "travellers"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      integration_events: {
        Row: {
          agency_id: string
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          integration_id: string | null
          payload: Json
          status: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          integration_id?: string | null
          payload?: Json
          status?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          integration_id?: string | null
          payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_events_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "agency_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: string
          agency_id: string
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          occurred_at: string
        }
        Insert: {
          activity_type: string
          agency_id: string
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          occurred_at?: string
        }
        Update: {
          activity_type?: string
          agency_id?: string
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_agency_id_lead_id_fkey"
            columns: ["agency_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      leads: {
        Row: {
          agency_id: string
          assigned_to: string | null
          created_at: string
          created_by: string | null
          email: string | null
          follow_up_at: string | null
          full_name: string
          id: string
          interest: string | null
          lead_ref: string | null
          metadata: Json
          notes: string | null
          phone: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          follow_up_at?: string | null
          full_name: string
          id?: string
          interest?: string | null
          lead_ref?: string | null
          metadata?: Json
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          follow_up_at?: string | null
          full_name?: string
          id?: string
          interest?: string | null
          lead_ref?: string | null
          metadata?: Json
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "agency_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      member_permissions: {
        Row: {
          is_allowed: boolean
          membership_id: string
          permission_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          is_allowed: boolean
          membership_id: string
          permission_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          is_allowed?: boolean
          membership_id?: string
          permission_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_permissions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "agency_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
        ]
      }
      packages: {
        Row: {
          agency_id: string
          capacity: number | null
          created_at: string
          created_by: string | null
          currency_code: string
          departure_date: string | null
          departure_location: string | null
          description: string | null
          duration_days: number | null
          id: string
          inclusions: Json
          metadata: Json
          name: string
          notes: string | null
          package_ref: string | null
          package_type: string | null
          price_minor: number
          return_date: string | null
          status: string
          supplier_name: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          departure_date?: string | null
          departure_location?: string | null
          description?: string | null
          duration_days?: number | null
          id?: string
          inclusions?: Json
          metadata?: Json
          name: string
          notes?: string | null
          package_ref?: string | null
          package_type?: string | null
          price_minor?: number
          return_date?: string | null
          status?: string
          supplier_name?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          departure_date?: string | null
          departure_location?: string | null
          description?: string | null
          duration_days?: number | null
          id?: string
          inclusions?: Json
          metadata?: Json
          name?: string
          notes?: string | null
          package_ref?: string | null
          package_type?: string | null
          price_minor?: number
          return_date?: string | null
          status?: string
          supplier_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reversals: {
        Row: {
          agency_id: string
          amount_minor: number
          created_at: string
          id: string
          payment_id: string
          reason: string
          reversed_by: string | null
        }
        Insert: {
          agency_id: string
          amount_minor: number
          created_at?: string
          id?: string
          payment_id: string
          reason: string
          reversed_by?: string | null
        }
        Update: {
          agency_id?: string
          amount_minor?: number
          created_at?: string
          id?: string
          payment_id?: string
          reason?: string
          reversed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_reversals_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reversals_agency_id_payment_id_fkey"
            columns: ["agency_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      payments: {
        Row: {
          agency_id: string
          amount_minor: number
          booking_id: string | null
          created_at: string
          currency_code: string
          customer_id: string | null
          external_reference: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          payment_ref: string | null
          recorded_by: string | null
          status: string
        }
        Insert: {
          agency_id: string
          amount_minor: number
          booking_id?: string | null
          created_at?: string
          currency_code?: string
          customer_id?: string | null
          external_reference?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_ref?: string | null
          recorded_by?: string | null
          status?: string
        }
        Update: {
          agency_id?: string
          amount_minor?: number
          booking_id?: string | null
          created_at?: string
          currency_code?: string
          customer_id?: string | null
          external_reference?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_ref?: string | null
          recorded_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_agency_id_booking_id_fkey"
            columns: ["agency_id", "booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "payments_agency_id_customer_id_fkey"
            columns: ["agency_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "payments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          code: string
          description: string
          module: string
        }
        Insert: {
          action: string
          code: string
          description: string
          module: string
        }
        Update: {
          action?: string
          code?: string
          description?: string
          module?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          code: string
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          max_additional_members: number
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_additional_members?: number
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_additional_members?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: []
      }
      platform_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_code: string
          role_id: string
        }
        Insert: {
          permission_code: string
          role_id: string
        }
        Update: {
          permission_code?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          agency_id: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          is_owner_role: boolean
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_owner_role?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_owner_role?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          agency_id: string | null
          agency_name_snapshot: string | null
          amount_minor: number | null
          billing_interval: string
          billing_provider: string | null
          cancel_at_period_end: boolean
          created_at: string
          currency_code: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string | null
          agency_name_snapshot?: string | null
          amount_minor?: number | null
          billing_interval?: string
          billing_provider?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          currency_code?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          amount_minor?: number | null
          billing_interval?: string
          billing_provider?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          currency_code?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_costs: {
        Row: {
          agency_id: string | null
          amount_minor: number
          booking_id: string | null
          created_at: string
          currency_code: string
          description: string
          due_date: string | null
          id: string
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string | null
          amount_minor: number
          booking_id?: string | null
          created_at?: string
          currency_code?: string
          description: string
          due_date?: string | null
          id?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          amount_minor?: number
          booking_id?: string | null
          created_at?: string
          currency_code?: string
          description?: string
          due_date?: string | null
          id?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_costs_agency_id_booking_id_fkey"
            columns: ["agency_id", "booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "supplier_costs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_costs_agency_id_supplier_id_fkey"
            columns: ["agency_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          agency_id: string | null
          amount_minor: number
          created_at: string
          currency_code: string
          id: string
          notes: string | null
          payment_date: string
          recorded_by: string | null
          reference: string | null
          status: string
          supplier_cost_id: string
        }
        Insert: {
          agency_id: string | null
          amount_minor: number
          created_at?: string
          currency_code?: string
          id?: string
          notes?: string | null
          payment_date?: string
          recorded_by?: string | null
          reference?: string | null
          status?: string
          supplier_cost_id: string
        }
        Update: {
          agency_id?: string | null
          amount_minor?: number
          created_at?: string
          currency_code?: string
          id?: string
          notes?: string | null
          payment_date?: string
          recorded_by?: string | null
          reference?: string | null
          status?: string
          supplier_cost_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_agency_id_supplier_cost_id_fkey"
            columns: ["agency_id", "supplier_cost_id"]
            isOneToOne: false
            referencedRelation: "supplier_costs"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      suppliers: {
        Row: {
          agency_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agency_id: string
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "agency_memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      travellers: {
        Row: {
          agency_id: string
          booking_id: string | null
          created_at: string
          customer_id: string | null
          date_of_birth: string | null
          full_name: string
          gender: string | null
          id: string
          metadata: Json
          nationality: string | null
          notes: string | null
          passport_expiry: string | null
          passport_number_encrypted: string | null
          room_group: string | null
          updated_at: string
          visa_status: string | null
        }
        Insert: {
          agency_id: string
          booking_id?: string | null
          created_at?: string
          customer_id?: string | null
          date_of_birth?: string | null
          full_name: string
          gender?: string | null
          id?: string
          metadata?: Json
          nationality?: string | null
          notes?: string | null
          passport_expiry?: string | null
          passport_number_encrypted?: string | null
          room_group?: string | null
          updated_at?: string
          visa_status?: string | null
        }
        Update: {
          agency_id?: string
          booking_id?: string | null
          created_at?: string
          customer_id?: string | null
          date_of_birth?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          metadata?: Json
          nationality?: string | null
          notes?: string | null
          passport_expiry?: string | null
          passport_number_encrypted?: string | null
          room_group?: string | null
          updated_at?: string
          visa_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travellers_agency_id_booking_id_fkey"
            columns: ["agency_id", "booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "travellers_agency_id_customer_id_fkey"
            columns: ["agency_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "travellers_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          provider: string
          provider_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider: string
          provider_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_event_id?: string
        }
        Relationships: []
      }
      website_intake_submissions: {
        Row: {
          agency_id: string
          connection_id: string
          created_at: string
          error_message: string | null
          external_submission_id: string
          id: string
          lead_id: string | null
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          agency_id: string
          connection_id: string
          created_at?: string
          error_message?: string | null
          external_submission_id: string
          id?: string
          lead_id?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          agency_id?: string
          connection_id?: string
          created_at?: string
          error_message?: string | null
          external_submission_id?: string
          id?: string
          lead_id?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_intake_submissions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_intake_submissions_agency_lead_fkey"
            columns: ["agency_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "website_intake_submissions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "agency_website_connections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_agency_application: {
        Args: { _application_id: string; _slug: string }
        Returns: string
      }
      get_my_agency_context: {
        Args: never
        Returns: {
          agency_id: string
          agency_name: string
          agency_slug: string
          is_owner: boolean
          max_additional_members: number
          membership_id: string
          plan_code: string
          plan_name: string
          role_code: string
          role_id: string
          subscription_status: string
        }[]
      }
      get_platform_admin_overview: { Args: never; Returns: Json }
      get_platform_user_activity: { Args: never; Returns: Json }
      get_platform_website_connections: { Args: never; Returns: Json }
      ingest_website_lead: {
        Args: {
          _external_submission_id: string
          _origin: string
          _payload: Json
          _token_hash: string
        }
        Returns: Json
      }
      platform_configure_website_connection: {
        Args: {
          _agency_id: string
          _allowed_origin: string
          _website_url: string
        }
        Returns: Json
      }
      platform_disable_website_connection: {
        Args: { _agency_id: string }
        Returns: undefined
      }
      reject_agency_application: {
        Args: { _application_id: string; _review_notes: string }
        Returns: undefined
      }
      reverse_agency_payment: {
        Args: { _payment_id: string; _reason: string }
        Returns: undefined
      }
      set_platform_agency_status: {
        Args: { _agency_id: string; _status: string }
        Returns: undefined
      }
      transition_agency_payment: {
        Args: { _payment_id: string; _reason?: string; _status: string }
        Returns: undefined
      }
      void_agency_supplier_payment: {
        Args: { _reason: string; _supplier_payment_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
