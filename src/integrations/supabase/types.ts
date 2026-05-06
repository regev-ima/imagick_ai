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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      client_interactions: {
        Row: {
          client_name: string | null
          created_at: string
          feedback_text: string | null
          gallery_id: string
          id: string
          image_id: string | null
          interaction_type: string
          ip_address: string | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          feedback_text?: string | null
          gallery_id: string
          id?: string
          image_id?: string | null
          interaction_type: string
          ip_address?: string | null
        }
        Update: {
          client_name?: string | null
          created_at?: string
          feedback_text?: string | null
          gallery_id?: string
          id?: string
          image_id?: string | null
          interaction_type?: string
          ip_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_interactions_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_interactions_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_interactions_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "gallery_images"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_grants: {
        Row: {
          created_at: string
          credits_initial: number
          credits_remaining: number
          expired_at: string | null
          expires_at: string
          grant_type: string
          granted_by: string | null
          id: string
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_initial: number
          credits_remaining: number
          expired_at?: string | null
          expires_at: string
          grant_type?: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_initial?: number
          credits_remaining?: number
          expired_at?: string | null
          expires_at?: string
          grant_type?: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_usage_logs: {
        Row: {
          action_type: string
          created_at: string
          credits_spent: number
          description: string | null
          gallery_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          credits_spent?: number
          description?: string | null
          gallery_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          credits_spent?: number
          description?: string | null
          gallery_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_usage_logs_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_usage_logs_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries_public"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          metadata: Json
          recipient_email: string
          resend_message_id: string | null
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_type: string
          error_message?: string | null
          id?: string
          metadata?: Json
          recipient_email: string
          resend_message_id?: string | null
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          recipient_email?: string
          resend_message_id?: string | null
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_sequence_steps: {
        Row: {
          body_html: string
          condition_check: string | null
          created_at: string
          delay_hours: number
          email_type: string
          id: string
          sequence_id: string
          step_order: number
          subject: string
          updated_at: string
        }
        Insert: {
          body_html: string
          condition_check?: string | null
          created_at?: string
          delay_hours?: number
          email_type?: string
          id?: string
          sequence_id: string
          step_order?: number
          subject: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          condition_check?: string | null
          created_at?: string
          delay_hours?: number
          email_type?: string
          id?: string
          sequence_id?: string
          step_order?: number
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          trigger_type: string
          trigger_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger_type?: string
          trigger_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger_type?: string
          trigger_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      face_clusters: {
        Row: {
          created_at: string
          face_count: number
          gallery_id: string
          id: string
          representative_bbox: Json | null
          representative_image_id: string | null
        }
        Insert: {
          created_at?: string
          face_count?: number
          gallery_id: string
          id?: string
          representative_bbox?: Json | null
          representative_image_id?: string | null
        }
        Update: {
          created_at?: string
          face_count?: number
          gallery_id?: string
          id?: string
          representative_bbox?: Json | null
          representative_image_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "face_clusters_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_clusters_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_clusters_representative_image_id_fkey"
            columns: ["representative_image_id"]
            isOneToOne: false
            referencedRelation: "gallery_images"
            referencedColumns: ["id"]
          },
        ]
      }
      face_detections: {
        Row: {
          azure_face_id: string | null
          bounding_box: Json
          cluster_id: string | null
          created_at: string
          face_vector: string | null
          gallery_id: string
          id: string
          image_id: string
        }
        Insert: {
          azure_face_id?: string | null
          bounding_box: Json
          cluster_id?: string | null
          created_at?: string
          face_vector?: string | null
          gallery_id: string
          id?: string
          image_id: string
        }
        Update: {
          azure_face_id?: string | null
          bounding_box?: Json
          cluster_id?: string | null
          created_at?: string
          face_vector?: string | null
          gallery_id?: string
          id?: string
          image_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "face_detections_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "face_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_detections_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_detections_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "face_detections_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "gallery_images"
            referencedColumns: ["id"]
          },
        ]
      }
      galleries: {
        Row: {
          ai_culling_enabled: boolean
          categories: string[] | null
          client_dark_mode: boolean | null
          client_link: string | null
          client_password: string | null
          created_at: string
          culling_completed_at: string | null
          culling_labels: string[] | null
          culling_started_at: string | null
          culling_status: string | null
          description: string | null
          download_enabled: boolean | null
          expiry_date: string | null
          face_search_completed_at: string | null
          face_search_error: string | null
          face_search_started_at: string | null
          face_search_status: string
          gallery_type: string | null
          hero_image_url: string | null
          id: string
          import_folders_completed: number
          import_folders_total: number
          name: string
          processed_images: number
          processing_completed_at: string | null
          processing_started_at: string | null
          selected_style_ids: string[] | null
          similarity_threshold: number | null
          source_drive_links: string[] | null
          status: string
          template: string | null
          total_images: number
          updated_at: string
          upload_completed_at: string | null
          upload_started_at: string | null
          user_id: string
          watermark_enabled: boolean | null
        }
        Insert: {
          ai_culling_enabled?: boolean
          categories?: string[] | null
          client_dark_mode?: boolean | null
          client_link?: string | null
          client_password?: string | null
          created_at?: string
          culling_completed_at?: string | null
          culling_labels?: string[] | null
          culling_started_at?: string | null
          culling_status?: string | null
          description?: string | null
          download_enabled?: boolean | null
          expiry_date?: string | null
          face_search_completed_at?: string | null
          face_search_error?: string | null
          face_search_started_at?: string | null
          face_search_status?: string
          gallery_type?: string | null
          hero_image_url?: string | null
          id?: string
          import_folders_completed?: number
          import_folders_total?: number
          name: string
          processed_images?: number
          processing_completed_at?: string | null
          processing_started_at?: string | null
          selected_style_ids?: string[] | null
          similarity_threshold?: number | null
          source_drive_links?: string[] | null
          status?: string
          template?: string | null
          total_images?: number
          updated_at?: string
          upload_completed_at?: string | null
          upload_started_at?: string | null
          user_id: string
          watermark_enabled?: boolean | null
        }
        Update: {
          ai_culling_enabled?: boolean
          categories?: string[] | null
          client_dark_mode?: boolean | null
          client_link?: string | null
          client_password?: string | null
          created_at?: string
          culling_completed_at?: string | null
          culling_labels?: string[] | null
          culling_started_at?: string | null
          culling_status?: string | null
          description?: string | null
          download_enabled?: boolean | null
          expiry_date?: string | null
          face_search_completed_at?: string | null
          face_search_error?: string | null
          face_search_started_at?: string | null
          face_search_status?: string
          gallery_type?: string | null
          hero_image_url?: string | null
          id?: string
          import_folders_completed?: number
          import_folders_total?: number
          name?: string
          processed_images?: number
          processing_completed_at?: string | null
          processing_started_at?: string | null
          selected_style_ids?: string[] | null
          similarity_threshold?: number | null
          source_drive_links?: string[] | null
          status?: string
          template?: string | null
          total_images?: number
          updated_at?: string
          upload_completed_at?: string | null
          upload_started_at?: string | null
          user_id?: string
          watermark_enabled?: boolean | null
        }
        Relationships: []
      }
      gallery_images: {
        Row: {
          ai_rating: number | null
          ai_tags: string[] | null
          aperture: string | null
          background_sharpness: number | null
          camera_make: string | null
          camera_model: string | null
          category: string | null
          created_at: string
          culling_label: string | null
          culling_score: number | null
          deleted_at: string | null
          edited_url: string | null
          file_size_bytes: number | null
          filename: string
          focal_length: string | null
          gallery_id: string
          height: number | null
          id: string
          intended_facial_expression: number | null
          is_hero: boolean
          is_liked: boolean
          iso: number | null
          last_processing_attempt_at: string | null
          last_processing_error: string | null
          lens_model: string | null
          original_url: string
          processing_attempts: number
          shutter_speed: string | null
          similarity_group_1: number | null
          similarity_group_2: number | null
          similarity_group_3: number | null
          sort_order: number | null
          status: string
          subject_sharpness: number | null
          taken_at: string | null
          thirds_rule: number | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          ai_rating?: number | null
          ai_tags?: string[] | null
          aperture?: string | null
          background_sharpness?: number | null
          camera_make?: string | null
          camera_model?: string | null
          category?: string | null
          created_at?: string
          culling_label?: string | null
          culling_score?: number | null
          deleted_at?: string | null
          edited_url?: string | null
          file_size_bytes?: number | null
          filename: string
          focal_length?: string | null
          gallery_id: string
          height?: number | null
          id?: string
          intended_facial_expression?: number | null
          is_hero?: boolean
          is_liked?: boolean
          iso?: number | null
          last_processing_attempt_at?: string | null
          last_processing_error?: string | null
          lens_model?: string | null
          original_url: string
          processing_attempts?: number
          shutter_speed?: string | null
          similarity_group_1?: number | null
          similarity_group_2?: number | null
          similarity_group_3?: number | null
          sort_order?: number | null
          status?: string
          subject_sharpness?: number | null
          taken_at?: string | null
          thirds_rule?: number | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          ai_rating?: number | null
          ai_tags?: string[] | null
          aperture?: string | null
          background_sharpness?: number | null
          camera_make?: string | null
          camera_model?: string | null
          category?: string | null
          created_at?: string
          culling_label?: string | null
          culling_score?: number | null
          deleted_at?: string | null
          edited_url?: string | null
          file_size_bytes?: number | null
          filename?: string
          focal_length?: string | null
          gallery_id?: string
          height?: number | null
          id?: string
          intended_facial_expression?: number | null
          is_hero?: boolean
          is_liked?: boolean
          iso?: number | null
          last_processing_attempt_at?: string | null
          last_processing_error?: string | null
          lens_model?: string | null
          original_url?: string
          processing_attempts?: number
          shutter_speed?: string | null
          similarity_group_1?: number | null
          similarity_group_2?: number | null
          similarity_group_3?: number | null
          sort_order?: number | null
          status?: string
          subject_sharpness?: number | null
          taken_at?: string | null
          thirds_rule?: number | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_images_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_images_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries_public"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_invites: {
        Row: {
          client_name: string | null
          created_at: string
          email: string
          gallery_id: string
          id: string
          sent_at: string | null
          viewed_at: string | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          email: string
          gallery_id: string
          id?: string
          sent_at?: string | null
          viewed_at?: string | null
        }
        Update: {
          client_name?: string | null
          created_at?: string
          email?: string
          gallery_id?: string
          id?: string
          sent_at?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_invites_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_invites_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries_public"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_sessions: {
        Row: {
          created_at: string
          expires_at: string
          gallery_id: string
          id: string
          session_token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          gallery_id: string
          id?: string
          session_token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          gallery_id?: string
          id?: string
          session_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_sessions_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_sessions_gallery_id_fkey"
            columns: ["gallery_id"]
            isOneToOne: false
            referencedRelation: "galleries_public"
            referencedColumns: ["id"]
          },
        ]
      }
      image_edits: {
        Row: {
          created_at: string
          edited_url: string
          gallery_id: string
          id: string
          image_id: string
          style_id: string | null
          style_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          edited_url: string
          gallery_id: string
          id?: string
          image_id: string
          style_id?: string | null
          style_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          edited_url?: string
          gallery_id?: string
          id?: string
          image_id?: string
          style_id?: string | null
          style_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_edits_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "gallery_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_edits_style_id_fkey"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "styles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          billing_cycle: string | null
          created_at: string
          description: string
          id: string
          invoice_number: string
          paypal_transaction_id: string | null
          pdf_storage_path: string | null
          plan_id: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          billing_cycle?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_number: string
          paypal_transaction_id?: string | null
          pdf_storage_path?: string | null
          plan_id?: string | null
          status?: string
          type?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_cycle?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_number?: string
          paypal_transaction_id?: string | null
          pdf_storage_path?: string | null
          plan_id?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_campaign_steps: {
        Row: {
          ab_enabled: boolean
          ab_split_percent: number
          body_html: string
          campaign_id: string
          created_at: string
          delay_hours: number
          id: string
          is_reply: boolean
          sender_profile: string
          step_order: number
          subject: string
          updated_at: string
          variant_b_body_html: string | null
          variant_b_subject: string | null
        }
        Insert: {
          ab_enabled?: boolean
          ab_split_percent?: number
          body_html?: string
          campaign_id: string
          created_at?: string
          delay_hours?: number
          id?: string
          is_reply?: boolean
          sender_profile?: string
          step_order?: number
          subject?: string
          updated_at?: string
          variant_b_body_html?: string | null
          variant_b_subject?: string | null
        }
        Update: {
          ab_enabled?: boolean
          ab_split_percent?: number
          body_html?: string
          campaign_id?: string
          created_at?: string
          delay_hours?: number
          id?: string
          is_reply?: boolean
          sender_profile?: string
          step_order?: number
          subject?: string
          updated_at?: string
          variant_b_body_html?: string | null
          variant_b_subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "lead_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_campaigns: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          send_window_end: number
          send_window_start: number
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          send_window_end?: number
          send_window_start?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          send_window_end?: number
          send_window_start?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_contacts: {
        Row: {
          city: string | null
          converted_at: string | null
          country_code: string | null
          country_name: string | null
          created_at: string
          email_normalized: string
          email_raw: string
          first_name: string | null
          geoip_looked_up_at: string | null
          geoip_provider: string | null
          id: string
          ip_address: string | null
          last_name: string | null
          source: string
          status: string
          suppression_reason: string | null
          timezone: string | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          converted_at?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          email_normalized: string
          email_raw: string
          first_name?: string | null
          geoip_looked_up_at?: string | null
          geoip_provider?: string | null
          id?: string
          ip_address?: string | null
          last_name?: string | null
          source?: string
          status?: string
          suppression_reason?: string | null
          timezone?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          converted_at?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          email_normalized?: string
          email_raw?: string
          first_name?: string | null
          geoip_looked_up_at?: string | null
          geoip_provider?: string | null
          id?: string
          ip_address?: string | null
          last_name?: string | null
          source?: string
          status?: string
          suppression_reason?: string | null
          timezone?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_email_opens: {
        Row: {
          device_type: string | null
          id: string
          ip_address: string | null
          lead_id: string | null
          opened_at: string
          scheduled_email_id: string
          user_agent: string | null
        }
        Insert: {
          device_type?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          opened_at?: string
          scheduled_email_id: string
          user_agent?: string | null
        }
        Update: {
          device_type?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          opened_at?: string
          scheduled_email_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_email_opens_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_email_opens_scheduled_email_id_fkey"
            columns: ["scheduled_email_id"]
            isOneToOne: false
            referencedRelation: "lead_scheduled_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_enrollments: {
        Row: {
          campaign_id: string
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          enrolled_at: string
          id: string
          last_sent_step: number | null
          lead_id: string
          release_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          enrolled_at?: string
          id?: string
          last_sent_step?: number | null
          lead_id: string
          release_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          enrolled_at?: string
          id?: string
          last_sent_step?: number | null
          lead_id?: string
          release_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_enrollments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "lead_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_enrollments_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "lead_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_geoip_cache: {
        Row: {
          country_code: string | null
          country_name: string | null
          ip_address: string
          looked_up_at: string | null
          provider: string | null
          timezone: string | null
        }
        Insert: {
          country_code?: string | null
          country_name?: string | null
          ip_address: string
          looked_up_at?: string | null
          provider?: string | null
          timezone?: string | null
        }
        Update: {
          country_code?: string | null
          country_name?: string | null
          ip_address?: string
          looked_up_at?: string | null
          provider?: string | null
          timezone?: string | null
        }
        Relationships: []
      }
      lead_import_job_rows: {
        Row: {
          created_at: string
          email_normalized: string | null
          email_raw: string | null
          first_name: string | null
          id: string
          import_job_id: string
          last_name: string | null
          lead_id: string | null
          reason: string | null
          result: string
          row_number: number
        }
        Insert: {
          created_at?: string
          email_normalized?: string | null
          email_raw?: string | null
          first_name?: string | null
          id?: string
          import_job_id: string
          last_name?: string | null
          lead_id?: string | null
          reason?: string | null
          result?: string
          row_number?: number
        }
        Update: {
          created_at?: string
          email_normalized?: string | null
          email_raw?: string | null
          first_name?: string | null
          id?: string
          import_job_id?: string
          last_name?: string | null
          lead_id?: string | null
          reason?: string | null
          result?: string
          row_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_import_job_rows_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "lead_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          duplicates_count: number
          file_name: string | null
          file_type: string | null
          id: string
          imported_count: number
          invalid_count: number
          mapping: Json
          processed_rows: number
          registered_count: number
          selected_campaign_id: string | null
          source: string
          started_at: string | null
          status: string
          suppressed_count: number
          total_rows: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          duplicates_count?: number
          file_name?: string | null
          file_type?: string | null
          id?: string
          imported_count?: number
          invalid_count?: number
          mapping?: Json
          processed_rows?: number
          registered_count?: number
          selected_campaign_id?: string | null
          source?: string
          started_at?: string | null
          status?: string
          suppressed_count?: number
          total_rows?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          duplicates_count?: number
          file_name?: string | null
          file_type?: string | null
          id?: string
          imported_count?: number
          invalid_count?: number
          mapping?: Json
          processed_rows?: number
          registered_count?: number
          selected_campaign_id?: string | null
          source?: string
          started_at?: string | null
          status?: string
          suppressed_count?: number
          total_rows?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_import_jobs_selected_campaign_id_fkey"
            columns: ["selected_campaign_id"]
            isOneToOne: false
            referencedRelation: "lead_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_releases: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string
          id: string
          label: string | null
          lead_count: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by: string
          id?: string
          label?: string | null
          lead_count?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string
          id?: string
          label?: string | null
          lead_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_releases_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "lead_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_scheduled_emails: {
        Row: {
          attempt_count: number
          body_snapshot: string
          campaign_id: string
          campaign_step_id: string
          created_at: string
          enrollment_id: string
          id: string
          is_reply: boolean
          last_error: string | null
          lead_id: string
          open_token: string
          opened_count: number
          opened_first_at: string | null
          release_id: string | null
          resend_message_id: string | null
          scheduled_at: string
          sender_profile: string
          sent_at: string | null
          status: string
          step_order: number
          subject_snapshot: string
          updated_at: string
          variant: string
        }
        Insert: {
          attempt_count?: number
          body_snapshot?: string
          campaign_id: string
          campaign_step_id: string
          created_at?: string
          enrollment_id: string
          id?: string
          is_reply?: boolean
          last_error?: string | null
          lead_id: string
          open_token?: string
          opened_count?: number
          opened_first_at?: string | null
          release_id?: string | null
          resend_message_id?: string | null
          scheduled_at?: string
          sender_profile?: string
          sent_at?: string | null
          status?: string
          step_order?: number
          subject_snapshot?: string
          updated_at?: string
          variant?: string
        }
        Update: {
          attempt_count?: number
          body_snapshot?: string
          campaign_id?: string
          campaign_step_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          is_reply?: boolean
          last_error?: string | null
          lead_id?: string
          open_token?: string
          opened_count?: number
          opened_first_at?: string | null
          release_id?: string | null
          resend_message_id?: string | null
          scheduled_at?: string
          sender_profile?: string
          sent_at?: string | null
          status?: string
          step_order?: number
          subject_snapshot?: string
          updated_at?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_scheduled_emails_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "lead_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_scheduled_emails_campaign_step_id_fkey"
            columns: ["campaign_step_id"]
            isOneToOne: false
            referencedRelation: "lead_campaign_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_scheduled_emails_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "lead_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_scheduled_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_scheduled_emails_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "lead_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_answers: {
        Row: {
          answer: Json
          answered_at: string
          created_at: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          answer?: Json
          answered_at?: string
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          answer?: Json
          answered_at?: string
          created_at?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "onboarding_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_questions: {
        Row: {
          allow_multiple: boolean
          created_at: string
          id: string
          is_active: boolean
          max_selections: number | null
          options: Json
          question_key: string
          question_type: string
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          allow_multiple?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          max_selections?: number | null
          options?: Json
          question_key: string
          question_type?: string
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          allow_multiple?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          max_selections?: number | null
          options?: Json
          question_key?: string
          question_type?: string
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_skips: {
        Row: {
          skipped_at: string
          user_id: string
        }
        Insert: {
          skipped_at?: string
          user_id: string
        }
        Update: {
          skipped_at?: string
          user_id?: string
        }
        Relationships: []
      }
      paypal_plan_mapping: {
        Row: {
          billing_cycle: string
          created_at: string
          id: string
          is_sandbox: boolean
          paypal_plan_id: string
          plan_id: string
        }
        Insert: {
          billing_cycle: string
          created_at?: string
          id?: string
          is_sandbox?: boolean
          paypal_plan_id: string
          plan_id: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          id?: string
          is_sandbox?: boolean
          paypal_plan_id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paypal_plan_mapping_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      paypal_webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          processed: boolean
          processed_at: string | null
          processing_error: string | null
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      styles: {
        Row: {
          after_image_urls: string[] | null
          allowed_user_ids: string[] | null
          associated_tags: string[] | null
          before_image_urls: string[] | null
          category: string | null
          created_at: string
          demo_images: string[] | null
          demo_link: string | null
          description: string | null
          error_details: string[] | null
          father_style_id: string | null
          google_after_metadata: Json | null
          google_after_urls: string[] | null
          google_before_metadata: Json | null
          google_before_urls: string[] | null
          history_ids: string[] | null
          id: string
          import_completion_date: string | null
          import_start_date: string | null
          import_transfers_completed: number | null
          import_transfers_total: number | null
          is_active: boolean
          is_preset: boolean
          manual_link_after: string | null
          manual_link_before: string | null
          matching_images_count: number | null
          name: string
          preview_images: string[] | null
          recommended: boolean | null
          slug: string | null
          sort_order: number | null
          status: string
          style_id_external: string | null
          team_remarks: string[] | null
          thumbnail_url: string | null
          total_images_imported: number | null
          total_images_to_import: number | null
          training_completion_date: string | null
          training_sessions_count: number | null
          training_start_date: string | null
          updated_at: string
          upload_method: string | null
          user_id: string
          visibility: string
        }
        Insert: {
          after_image_urls?: string[] | null
          allowed_user_ids?: string[] | null
          associated_tags?: string[] | null
          before_image_urls?: string[] | null
          category?: string | null
          created_at?: string
          demo_images?: string[] | null
          demo_link?: string | null
          description?: string | null
          error_details?: string[] | null
          father_style_id?: string | null
          google_after_metadata?: Json | null
          google_after_urls?: string[] | null
          google_before_metadata?: Json | null
          google_before_urls?: string[] | null
          history_ids?: string[] | null
          id?: string
          import_completion_date?: string | null
          import_start_date?: string | null
          import_transfers_completed?: number | null
          import_transfers_total?: number | null
          is_active?: boolean
          is_preset?: boolean
          manual_link_after?: string | null
          manual_link_before?: string | null
          matching_images_count?: number | null
          name: string
          preview_images?: string[] | null
          recommended?: boolean | null
          slug?: string | null
          sort_order?: number | null
          status?: string
          style_id_external?: string | null
          team_remarks?: string[] | null
          thumbnail_url?: string | null
          total_images_imported?: number | null
          total_images_to_import?: number | null
          training_completion_date?: string | null
          training_sessions_count?: number | null
          training_start_date?: string | null
          updated_at?: string
          upload_method?: string | null
          user_id: string
          visibility?: string
        }
        Update: {
          after_image_urls?: string[] | null
          allowed_user_ids?: string[] | null
          associated_tags?: string[] | null
          before_image_urls?: string[] | null
          category?: string | null
          created_at?: string
          demo_images?: string[] | null
          demo_link?: string | null
          description?: string | null
          error_details?: string[] | null
          father_style_id?: string | null
          google_after_metadata?: Json | null
          google_after_urls?: string[] | null
          google_before_metadata?: Json | null
          google_before_urls?: string[] | null
          history_ids?: string[] | null
          id?: string
          import_completion_date?: string | null
          import_start_date?: string | null
          import_transfers_completed?: number | null
          import_transfers_total?: number | null
          is_active?: boolean
          is_preset?: boolean
          manual_link_after?: string | null
          manual_link_before?: string | null
          matching_images_count?: number | null
          name?: string
          preview_images?: string[] | null
          recommended?: boolean | null
          slug?: string | null
          sort_order?: number | null
          status?: string
          style_id_external?: string | null
          team_remarks?: string[] | null
          thumbnail_url?: string | null
          total_images_imported?: number | null
          total_images_to_import?: number | null
          training_completion_date?: string | null
          training_sessions_count?: number | null
          training_start_date?: string | null
          updated_at?: string
          upload_method?: string | null
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "styles_father_style_id_fkey"
            columns: ["father_style_id"]
            isOneToOne: false
            referencedRelation: "styles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          edits_included: number
          features: Json | null
          has_ai_culling: boolean
          has_api_access: boolean
          has_full_style_library: boolean
          has_priority_support: boolean
          has_team_access: boolean
          id: string
          is_active: boolean
          max_storage_gb: number
          max_styles: number
          name: string
          price_monthly: number
          price_per_extra_edit: number
          price_yearly: number
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          edits_included?: number
          features?: Json | null
          has_ai_culling?: boolean
          has_api_access?: boolean
          has_full_style_library?: boolean
          has_priority_support?: boolean
          has_team_access?: boolean
          id?: string
          is_active?: boolean
          max_storage_gb?: number
          max_styles?: number
          name: string
          price_monthly?: number
          price_per_extra_edit?: number
          price_yearly?: number
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          edits_included?: number
          features?: Json | null
          has_ai_culling?: boolean
          has_api_access?: boolean
          has_full_style_library?: boolean
          has_priority_support?: boolean
          has_team_access?: boolean
          id?: string
          is_active?: boolean
          max_storage_gb?: number
          max_styles?: number
          name?: string
          price_monthly?: number
          price_per_extra_edit?: number
          price_yearly?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_addons: {
        Row: {
          addon_type: string
          cancelled_at: string | null
          created_at: string
          id: string
          invoice_id: string | null
          paypal_order_id: string | null
          paypal_subscription_id: string | null
          quantity: number
          status: string
          user_id: string
        }
        Insert: {
          addon_type: string
          cancelled_at?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          paypal_order_id?: string | null
          paypal_subscription_id?: string | null
          quantity?: number
          status?: string
          user_id: string
        }
        Update: {
          addon_type?: string
          cancelled_at?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          paypal_order_id?: string | null
          paypal_subscription_id?: string | null
          quantity?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_email_preferences: {
        Row: {
          gallery_images_ready: boolean
          gallery_shared: boolean
          gallery_upload_complete: boolean
          journey_emails: boolean
          re_edit_complete: boolean
          re_edit_submitted: boolean
          style_ready: boolean
          style_training_started: boolean
          subscription_change: boolean
          updated_at: string
          user_id: string
          welcome_email: boolean
        }
        Insert: {
          gallery_images_ready?: boolean
          gallery_shared?: boolean
          gallery_upload_complete?: boolean
          journey_emails?: boolean
          re_edit_complete?: boolean
          re_edit_submitted?: boolean
          style_ready?: boolean
          style_training_started?: boolean
          subscription_change?: boolean
          updated_at?: string
          user_id: string
          welcome_email?: boolean
        }
        Update: {
          gallery_images_ready?: boolean
          gallery_shared?: boolean
          gallery_upload_complete?: boolean
          journey_emails?: boolean
          re_edit_complete?: boolean
          re_edit_submitted?: boolean
          style_ready?: boolean
          style_training_started?: boolean
          subscription_change?: boolean
          updated_at?: string
          user_id?: string
          welcome_email?: boolean
        }
        Relationships: []
      }
      user_lifecycle_profiles: {
        Row: {
          conversion_score: number
          created_at: string
          days_since_signup: number
          gallery_count: number
          images_processed: number
          is_paid: boolean
          last_active_at: string | null
          last_computed_at: string | null
          lifecycle_stage: string
          login_count: number
          previous_stage: string | null
          stage_changed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversion_score?: number
          created_at?: string
          days_since_signup?: number
          gallery_count?: number
          images_processed?: number
          is_paid?: boolean
          last_active_at?: string | null
          last_computed_at?: string | null
          lifecycle_stage?: string
          login_count?: number
          previous_stage?: string | null
          stage_changed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversion_score?: number
          created_at?: string
          days_since_signup?: number
          gallery_count?: number
          images_processed?: number
          is_paid?: boolean
          last_active_at?: string | null
          last_computed_at?: string | null
          lifecycle_stage?: string
          login_count?: number
          previous_stage?: string | null
          stage_changed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          can_view_analytics: boolean
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          can_view_analytics?: boolean
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          can_view_analytics?: boolean
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sequence_enrollments: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          current_step: number
          enrolled_at: string
          id: string
          next_send_at: string | null
          sequence_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          current_step?: number
          enrolled_at?: string
          id?: string
          next_send_at?: string | null
          sequence_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          current_step?: number
          enrolled_at?: string
          id?: string
          next_send_at?: string | null
          sequence_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          browser: string | null
          color_scheme: string | null
          created_at: string
          device_type: string | null
          id: string
          ip_address: string | null
          os: string | null
          screen_height: number | null
          screen_width: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          color_scheme?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          ip_address?: string | null
          os?: string | null
          screen_height?: number | null
          screen_width?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          color_scheme?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          ip_address?: string | null
          os?: string | null
          screen_height?: number | null
          screen_width?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          billing_cycle: string
          cancel_at_period_end: boolean
          created_at: string
          edits_remaining: number
          edits_used: number
          current_period_end: string
          current_period_start: string
          edits_reserved: number
          id: string
          last_payment_at: string | null
          paypal_plan_id: string | null
          paypal_subscription_id: string | null
          plan_id: string
          preferred_language: string
          scheduled_change_at: string | null
          scheduled_plan_id: string | null
          status: string
          storage_used_mb: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          suspension_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          created_at?: string
          edits_remaining?: number
          edits_used?: number
          current_period_end?: string
          current_period_start?: string
          edits_reserved?: number
          id?: string
          last_payment_at?: string | null
          paypal_plan_id?: string | null
          paypal_subscription_id?: string | null
          plan_id: string
          preferred_language?: string
          scheduled_change_at?: string | null
          scheduled_plan_id?: string | null
          status?: string
          storage_used_mb?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          suspension_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          created_at?: string
          edits_remaining?: number
          edits_used?: number
          current_period_end?: string
          current_period_start?: string
          edits_reserved?: number
          id?: string
          last_payment_at?: string | null
          paypal_plan_id?: string | null
          paypal_subscription_id?: string | null
          plan_id?: string
          preferred_language?: string
          scheduled_change_at?: string | null
          scheduled_plan_id?: string | null
          status?: string
          storage_used_mb?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          suspension_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      galleries_public: {
        Row: {
          categories: string[] | null
          client_dark_mode: boolean | null
          client_link: string | null
          description: string | null
          download_enabled: boolean | null
          expiry_date: string | null
          hero_image_url: string | null
          id: string | null
          name: string | null
          requires_password: boolean | null
          template: string | null
          total_images: number | null
          watermark_enabled: boolean | null
        }
        Insert: {
          categories?: string[] | null
          client_dark_mode?: boolean | null
          client_link?: string | null
          description?: string | null
          download_enabled?: boolean | null
          expiry_date?: string | null
          hero_image_url?: string | null
          id?: string | null
          name?: string | null
          requires_password?: never
          template?: string | null
          total_images?: number | null
          watermark_enabled?: boolean | null
        }
        Update: {
          categories?: string[] | null
          client_dark_mode?: boolean | null
          client_link?: string | null
          description?: string | null
          download_enabled?: boolean | null
          expiry_date?: string | null
          hero_image_url?: string | null
          id?: string | null
          name?: string | null
          requires_password?: never
          template?: string | null
          total_images?: number | null
          watermark_enabled?: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_grant_credits: {
        Args: {
          p_amount: number
          p_expires_at: string
          p_reason?: string
          p_user_id: string
        }
        Returns: string
      }
      claim_pending_lead_emails: {
        Args: { p_limit?: number }
        Returns: {
          attempt_count: number
          body_snapshot: string
          campaign_id: string
          enrollment_id: string
          id: string
          is_reply: boolean
          lead_id: string
          open_token: string
          sender_profile: string
          step_order: number
          subject_snapshot: string
        }[]
      }
      cluster_gallery_faces: {
        Args: { p_distance_threshold?: number; p_gallery_id: string }
        Returns: number
      }
      count_images_missing_edits: {
        Args: { p_gallery_id: string; p_style_ids: string[] }
        Returns: number
      }
      expire_credit_grants: { Args: never; Returns: number }
      gallery_has_client_link: {
        Args: { p_gallery_id: string }
        Returns: boolean
      }
      gallery_is_public: { Args: { p_gallery_id: string }; Returns: boolean }
      get_client_gallery_images: {
        Args: { p_gallery_id: string; p_session_token?: string }
        Returns: {
          ai_rating: number
          culling_label: string
          filename: string
          id: string
          is_liked: boolean
          original_url: string
          thumbnail_url: string
        }[]
      }
      get_admin_kpi_overview: {
        Args: never
        Returns: {
          active_subscribers: number
          mrr_usd: number
          cancellations_30d: number
          churn_pct_30d: number
          edits_today: number
          edits_7d: number
          edits_30d: number
          signups_7d: number
          signups_30d: number
          computed_at: string
        }
      }
      get_edits_per_user: {
        Args: never
        Returns: {
          edits_count: number
          user_id: string
        }[]
      }
      get_face_distances: {
        Args: { p_gallery_id: string }
        Returns: {
          distance: number
          face_a: string
          face_b: string
          image_a: string
          image_b: string
        }[]
      }
      get_images_missing_edits: {
        Args: { p_gallery_id: string; p_limit?: number; p_style_ids: string[] }
        Returns: {
          filename: string
          id: string
          original_url: string
          processing_attempts: number
        }[]
      }
      get_public_gallery: {
        Args: { p_client_link: string }
        Returns: {
          categories: string[]
          client_dark_mode: boolean
          client_link: string
          description: string
          download_enabled: boolean
          expiry_date: string
          hero_image_url: string
          id: string
          name: string
          requires_password: boolean
          template: string
          total_images: number
          watermark_enabled: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_gallery_folder_completed: {
        Args: { p_gallery_id: string }
        Returns: {
          import_folders_completed: number
          import_folders_total: number
        }[]
      }
      increment_lifecycle_login: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      increment_style_transfer_completed: {
        Args: { p_style_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      lookup_registered_emails: {
        Args: { p_emails: string[] }
        Returns: {
          email_normalized: string
        }[]
      }
      normalize_email: { Args: { raw: string }; Returns: string }
      recalculate_user_storage: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      resolve_short_link: { Args: { p_short_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
