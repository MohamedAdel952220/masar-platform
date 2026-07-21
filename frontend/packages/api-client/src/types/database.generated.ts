/* eslint-disable */
/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Produced from the live deployed database with:
 *   supabase gen types typescript --linked --schema <13 exposed schemas>
 *
 * This is the SINGLE SOURCE OF TRUTH for every backend contract the
 * frontend consumes. No row, enum, or function signature is hand-copied
 * anywhere else in this package — read builders, RPC wrappers, and query
 * hooks all derive their types from here.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  academic: {
    Tables: {
      attendance_records: {
        Row: {
          child_id: string;
          classroom_id: string;
          created_at: string;
          date: string;
          id: string;
          marked_by: string;
          notified_at: string | null;
          notified_parent: boolean;
          present: boolean;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          child_id: string;
          classroom_id: string;
          created_at?: string;
          date: string;
          id?: string;
          marked_by: string;
          notified_at?: string | null;
          notified_parent?: boolean;
          present: boolean;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          child_id?: string;
          classroom_id?: string;
          created_at?: string;
          date?: string;
          id?: string;
          marked_by?: string;
          notified_at?: string | null;
          notified_parent?: boolean;
          present?: boolean;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_records_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_records_classroom_id_fkey';
            columns: ['classroom_id'];
            isOneToOne: false;
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          },
        ];
      };
      child_guardian_links: {
        Row: {
          child_id: string;
          guardian_id: string;
          is_primary_contact: boolean;
          relation: Database['academic']['Enums']['guardian_relation'];
          tenant_id: string;
        };
        Insert: {
          child_id: string;
          guardian_id: string;
          is_primary_contact?: boolean;
          relation: Database['academic']['Enums']['guardian_relation'];
          tenant_id: string;
        };
        Update: {
          child_id?: string;
          guardian_id?: string;
          is_primary_contact?: boolean;
          relation?: Database['academic']['Enums']['guardian_relation'];
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'child_guardian_links_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
        ];
      };
      children: {
        Row: {
          address_lat: number | null;
          address_line: string | null;
          address_lng: number | null;
          allergies: string | null;
          area: string | null;
          blood_type: string | null;
          building: string | null;
          city: string | null;
          classroom_id: string;
          created_at: string;
          created_by: string | null;
          day_path_status: Database['academic']['Enums']['day_path_status'];
          deleted_at: string | null;
          dob: string;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          emergency_contact_relation: string | null;
          enrolled_at: string;
          father_job: string | null;
          father_name: string | null;
          father_national_id: string | null;
          father_phone: string | null;
          gender: Database['academic']['Enums']['gender'];
          id: string;
          membership_status: Database['academic']['Enums']['membership_status'];
          mother_job: string | null;
          mother_name: string | null;
          mother_national_id: string | null;
          mother_phone: string | null;
          name: string;
          name_ar: string | null;
          notes: string | null;
          package: Database['academic']['Enums']['package_type'];
          photo_object_id: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          address_lat?: number | null;
          address_line?: string | null;
          address_lng?: number | null;
          allergies?: string | null;
          area?: string | null;
          blood_type?: string | null;
          building?: string | null;
          city?: string | null;
          classroom_id: string;
          created_at?: string;
          created_by?: string | null;
          day_path_status?: Database['academic']['Enums']['day_path_status'];
          deleted_at?: string | null;
          dob: string;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relation?: string | null;
          enrolled_at?: string;
          father_job?: string | null;
          father_name?: string | null;
          father_national_id?: string | null;
          father_phone?: string | null;
          gender: Database['academic']['Enums']['gender'];
          id?: string;
          membership_status?: Database['academic']['Enums']['membership_status'];
          mother_job?: string | null;
          mother_name?: string | null;
          mother_national_id?: string | null;
          mother_phone?: string | null;
          name: string;
          name_ar?: string | null;
          notes?: string | null;
          package: Database['academic']['Enums']['package_type'];
          photo_object_id?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          address_lat?: number | null;
          address_line?: string | null;
          address_lng?: number | null;
          allergies?: string | null;
          area?: string | null;
          blood_type?: string | null;
          building?: string | null;
          city?: string | null;
          classroom_id?: string;
          created_at?: string;
          created_by?: string | null;
          day_path_status?: Database['academic']['Enums']['day_path_status'];
          deleted_at?: string | null;
          dob?: string;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relation?: string | null;
          enrolled_at?: string;
          father_job?: string | null;
          father_name?: string | null;
          father_national_id?: string | null;
          father_phone?: string | null;
          gender?: Database['academic']['Enums']['gender'];
          id?: string;
          membership_status?: Database['academic']['Enums']['membership_status'];
          mother_job?: string | null;
          mother_name?: string | null;
          mother_national_id?: string | null;
          mother_phone?: string | null;
          name?: string;
          name_ar?: string | null;
          notes?: string | null;
          package?: Database['academic']['Enums']['package_type'];
          photo_object_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'children_classroom_id_fkey';
            columns: ['classroom_id'];
            isOneToOne: false;
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          },
        ];
      };
      classrooms: {
        Row: {
          age_max_months: number;
          age_min_months: number;
          capacity: number;
          color_tag: string | null;
          coordinator_staff_id: string | null;
          created_at: string;
          deleted_at: string | null;
          grade: Database['academic']['Enums']['grade_level'];
          id: string;
          name: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          age_max_months: number;
          age_min_months: number;
          capacity: number;
          color_tag?: string | null;
          coordinator_staff_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          grade: Database['academic']['Enums']['grade_level'];
          id?: string;
          name: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          age_max_months?: number;
          age_min_months?: number;
          capacity?: number;
          color_tag?: string | null;
          coordinator_staff_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          grade?: Database['academic']['Enums']['grade_level'];
          id?: string;
          name?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      concerns: {
        Row: {
          category: Database['academic']['Enums']['concern_category'];
          child_id: string;
          created_at: string;
          id: string;
          message: string;
          priority: Database['academic']['Enums']['concern_priority'];
          raised_by: string;
          resolved_at: string | null;
          status: Database['academic']['Enums']['concern_status'];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          category: Database['academic']['Enums']['concern_category'];
          child_id: string;
          created_at?: string;
          id?: string;
          message: string;
          priority: Database['academic']['Enums']['concern_priority'];
          raised_by: string;
          resolved_at?: string | null;
          status?: Database['academic']['Enums']['concern_status'];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          category?: Database['academic']['Enums']['concern_category'];
          child_id?: string;
          created_at?: string;
          id?: string;
          message?: string;
          priority?: Database['academic']['Enums']['concern_priority'];
          raised_by?: string;
          resolved_at?: string | null;
          status?: Database['academic']['Enums']['concern_status'];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'concerns_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
        ];
      };
      day_path_events: {
        Row: {
          actor_id: string | null;
          child_id: string;
          classroom_id: string;
          id: string;
          occurred_at: string;
          source: Database['academic']['Enums']['day_path_source'];
          status: Database['academic']['Enums']['day_path_status'];
          tenant_id: string;
        };
        Insert: {
          actor_id?: string | null;
          child_id: string;
          classroom_id: string;
          id?: string;
          occurred_at?: string;
          source: Database['academic']['Enums']['day_path_source'];
          status: Database['academic']['Enums']['day_path_status'];
          tenant_id: string;
        };
        Update: {
          actor_id?: string | null;
          child_id?: string;
          classroom_id?: string;
          id?: string;
          occurred_at?: string;
          source?: Database['academic']['Enums']['day_path_source'];
          status?: Database['academic']['Enums']['day_path_status'];
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'day_path_events_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'day_path_events_classroom_id_fkey';
            columns: ['classroom_id'];
            isOneToOne: false;
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          },
        ];
      };
      evaluations: {
        Row: {
          behavior: number;
          child_id: string;
          classroom_id: string;
          created_at: string;
          created_by: string;
          homework: Database['academic']['Enums']['homework_status'];
          id: string;
          lesson_id: string;
          note: string | null;
          note_ai_polished: boolean;
          participation: number;
          tenant_id: string;
          understanding: number;
          updated_at: string;
        };
        Insert: {
          behavior: number;
          child_id: string;
          classroom_id: string;
          created_at?: string;
          created_by: string;
          homework: Database['academic']['Enums']['homework_status'];
          id?: string;
          lesson_id: string;
          note?: string | null;
          note_ai_polished?: boolean;
          participation: number;
          tenant_id: string;
          understanding: number;
          updated_at?: string;
        };
        Update: {
          behavior?: number;
          child_id?: string;
          classroom_id?: string;
          created_at?: string;
          created_by?: string;
          homework?: Database['academic']['Enums']['homework_status'];
          id?: string;
          lesson_id?: string;
          note?: string | null;
          note_ai_polished?: boolean;
          participation?: number;
          tenant_id?: string;
          understanding?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'evaluations_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evaluations_classroom_id_fkey';
            columns: ['classroom_id'];
            isOneToOne: false;
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'evaluations_lesson_id_fkey';
            columns: ['lesson_id'];
            isOneToOne: false;
            referencedRelation: 'lessons';
            referencedColumns: ['id'];
          },
        ];
      };
      lessons: {
        Row: {
          classroom_id: string;
          covered_ar: string | null;
          covered_en: string | null;
          created_at: string;
          created_by: string;
          date: string;
          id: string;
          objective_ar: string | null;
          objective_en: string | null;
          subject_id: string;
          tenant_id: string;
          title_ar: string | null;
          title_en: string;
          updated_at: string;
        };
        Insert: {
          classroom_id: string;
          covered_ar?: string | null;
          covered_en?: string | null;
          created_at?: string;
          created_by: string;
          date: string;
          id?: string;
          objective_ar?: string | null;
          objective_en?: string | null;
          subject_id: string;
          tenant_id: string;
          title_ar?: string | null;
          title_en: string;
          updated_at?: string;
        };
        Update: {
          classroom_id?: string;
          covered_ar?: string | null;
          covered_en?: string | null;
          created_at?: string;
          created_by?: string;
          date?: string;
          id?: string;
          objective_ar?: string | null;
          objective_en?: string | null;
          subject_id?: string;
          tenant_id?: string;
          title_ar?: string | null;
          title_en?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lessons_classroom_id_fkey';
            columns: ['classroom_id'];
            isOneToOne: false;
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lessons_subject_id_fkey';
            columns: ['subject_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id'];
          },
        ];
      };
      subjects: {
        Row: {
          classroom_id: string;
          created_at: string;
          id: string;
          name: string;
          teacher_staff_id: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          classroom_id: string;
          created_at?: string;
          id?: string;
          name: string;
          teacher_staff_id?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          classroom_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          teacher_staff_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subjects_classroom_id_fkey';
            columns: ['classroom_id'];
            isOneToOne: false;
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      v_child_attendance_summary: {
        Row: {
          attendance_pct: number | null;
          child_id: string | null;
          classroom_id: string | null;
          computed_at: string | null;
          present_days: number | null;
          tenant_id: string | null;
          total_days: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      children_driver_safe: {
        Args: never;
        Returns: {
          address_lat: number;
          address_line: string;
          address_lng: number;
          area: string;
          building: string;
          city: string;
          classroom_id: string;
          id: string;
          name: string;
          name_ar: string;
          photo_object_id: string;
          tenant_id: string;
        }[];
      };
      children_reception_safe: {
        Args: never;
        Returns: {
          classroom_id: string;
          father_name: string;
          father_phone: string;
          id: string;
          mother_name: string;
          mother_phone: string;
          name: string;
          name_ar: string;
          photo_object_id: string;
          tenant_id: string;
        }[];
      };
      classrooms_reception_safe: {
        Args: never;
        Returns: {
          capacity: number;
          color_tag: string;
          grade: Database['academic']['Enums']['grade_level'];
          id: string;
          name: string;
          tenant_id: string;
        }[];
      };
      set_child_day_path_status: {
        Args: {
          p_child_id: string;
          p_source: Database['academic']['Enums']['day_path_source'];
          p_status: Database['academic']['Enums']['day_path_status'];
        };
        Returns: undefined;
      };
    };
    Enums: {
      concern_category: 'academic' | 'behavior' | 'social' | 'health';
      concern_priority: 'info' | 'attention' | 'urgent';
      concern_status: 'open' | 'acknowledged' | 'resolved';
      day_path_source: 'driver' | 'teacher' | 'reception' | 'system';
      day_path_status: 'at_home' | 'in_bus' | 'classroom' | 'playing' | 'nap' | 'delivered';
      gender: 'male' | 'female';
      grade_level: 'pre_kg' | 'kg1' | 'kg2' | 'nursery';
      guardian_relation: 'father' | 'mother' | 'guardian';
      homework_status: 'done' | 'partial' | 'none';
      membership_status: 'active' | 'overdue' | 'suspended';
      package_type: 'full_day' | 'half_day';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  approvals: {
    Tables: {
      event_rsvps: {
        Row: {
          attendee: Database['approvals']['Enums']['rsvp_attendee'];
          child_id: string;
          contact_phone: string | null;
          event_id: string;
          extra_guest_name: string | null;
          extra_guest_relation: string | null;
          id: string;
          responded_at: string;
          tenant_id: string;
        };
        Insert: {
          attendee: Database['approvals']['Enums']['rsvp_attendee'];
          child_id: string;
          contact_phone?: string | null;
          event_id: string;
          extra_guest_name?: string | null;
          extra_guest_relation?: string | null;
          id?: string;
          responded_at?: string;
          tenant_id: string;
        };
        Update: {
          attendee?: Database['approvals']['Enums']['rsvp_attendee'];
          child_id?: string;
          contact_phone?: string | null;
          event_id?: string;
          extra_guest_name?: string | null;
          extra_guest_relation?: string | null;
          id?: string;
          responded_at?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_rsvps_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      event_trip_registrations: {
        Row: {
          child_id: string;
          created_at: string;
          event_id: string;
          id: string;
          payment_transaction_id: string | null;
          status: Database['approvals']['Enums']['trip_registration_status'];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          event_id: string;
          id?: string;
          payment_transaction_id?: string | null;
          status?: Database['approvals']['Enums']['trip_registration_status'];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          event_id?: string;
          id?: string;
          payment_transaction_id?: string | null;
          status?: Database['approvals']['Enums']['trip_registration_status'];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_trip_registrations_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          capacity: number | null;
          classroom_id: string | null;
          created_at: string;
          description: string | null;
          event_date: string;
          event_time: string | null;
          id: string;
          place: string | null;
          price: number | null;
          source_request_id: string | null;
          tenant_id: string;
          title: string;
          type: Database['approvals']['Enums']['event_type'];
          updated_at: string;
        };
        Insert: {
          capacity?: number | null;
          classroom_id?: string | null;
          created_at?: string;
          description?: string | null;
          event_date: string;
          event_time?: string | null;
          id?: string;
          place?: string | null;
          price?: number | null;
          source_request_id?: string | null;
          tenant_id: string;
          title: string;
          type: Database['approvals']['Enums']['event_type'];
          updated_at?: string;
        };
        Update: {
          capacity?: number | null;
          classroom_id?: string | null;
          created_at?: string;
          description?: string | null;
          event_date?: string;
          event_time?: string | null;
          id?: string;
          place?: string | null;
          price?: number | null;
          source_request_id?: string | null;
          tenant_id?: string;
          title?: string;
          type?: Database['approvals']['Enums']['event_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'events_source_request_id_fkey';
            columns: ['source_request_id'];
            isOneToOne: false;
            referencedRelation: 'requests';
            referencedColumns: ['id'];
          },
        ];
      };
      requests: {
        Row: {
          attachment_object_id: string | null;
          classroom_id: string | null;
          created_at: string;
          exam_kind: Database['approvals']['Enums']['exam_kind'] | null;
          id: string;
          note: string | null;
          place: string | null;
          price: number | null;
          rejection_reason: string | null;
          request_date: string;
          request_time: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database['approvals']['Enums']['request_status'];
          subject_id: string | null;
          submitted_by: string;
          tenant_id: string;
          title: string;
          type: Database['approvals']['Enums']['request_type'];
          updated_at: string;
        };
        Insert: {
          attachment_object_id?: string | null;
          classroom_id?: string | null;
          created_at?: string;
          exam_kind?: Database['approvals']['Enums']['exam_kind'] | null;
          id?: string;
          note?: string | null;
          place?: string | null;
          price?: number | null;
          rejection_reason?: string | null;
          request_date: string;
          request_time?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['approvals']['Enums']['request_status'];
          subject_id?: string | null;
          submitted_by: string;
          tenant_id: string;
          title: string;
          type: Database['approvals']['Enums']['request_type'];
          updated_at?: string;
        };
        Update: {
          attachment_object_id?: string | null;
          classroom_id?: string | null;
          created_at?: string;
          exam_kind?: Database['approvals']['Enums']['exam_kind'] | null;
          id?: string;
          note?: string | null;
          place?: string | null;
          price?: number | null;
          rejection_reason?: string | null;
          request_date?: string;
          request_time?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['approvals']['Enums']['request_status'];
          subject_id?: string | null;
          submitted_by?: string;
          tenant_id?: string;
          title?: string;
          type?: Database['approvals']['Enums']['request_type'];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      event_type: 'exam' | 'celebration' | 'trip';
      exam_kind: 'weekly' | 'monthly';
      request_status: 'pending' | 'approved' | 'rejected';
      request_type: 'event' | 'trip' | 'exam';
      rsvp_attendee: 'child' | 'father' | 'mother' | 'both';
      trip_registration_status: 'open' | 'registered' | 'paid' | 'cancelled';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  billing: {
    Tables: {
      billing_ledger_items: {
        Row: {
          amount_due: number;
          amount_paid: number;
          child_id: string;
          created_at: string;
          due_date: string;
          fee_item_id: string;
          id: string;
          period_label: string;
          status: Database['billing']['Enums']['billing_status'];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          amount_due: number;
          amount_paid?: number;
          child_id: string;
          created_at?: string;
          due_date: string;
          fee_item_id: string;
          id?: string;
          period_label: string;
          status?: Database['billing']['Enums']['billing_status'];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          amount_due?: number;
          amount_paid?: number;
          child_id?: string;
          created_at?: string;
          due_date?: string;
          fee_item_id?: string;
          id?: string;
          period_label?: string;
          status?: Database['billing']['Enums']['billing_status'];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_ledger_items_fee_item_id_fkey';
            columns: ['fee_item_id'];
            isOneToOne: false;
            referencedRelation: 'fee_items';
            referencedColumns: ['id'];
          },
        ];
      };
      fee_item_applicability: {
        Row: {
          child_id: string;
          created_at: string;
          fee_item_id: string;
          tenant_id: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          fee_item_id: string;
          tenant_id: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          fee_item_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fee_item_applicability_fee_item_id_fkey';
            columns: ['fee_item_id'];
            isOneToOne: false;
            referencedRelation: 'fee_items';
            referencedColumns: ['id'];
          },
        ];
      };
      fee_items: {
        Row: {
          active: boolean;
          created_at: string;
          cycle: Database['billing']['Enums']['fee_cycle'];
          icon: string | null;
          id: string;
          name: string;
          name_ar: string | null;
          price: number;
          required: boolean;
          scope: Database['billing']['Enums']['fee_scope'];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          cycle: Database['billing']['Enums']['fee_cycle'];
          icon?: string | null;
          id?: string;
          name: string;
          name_ar?: string | null;
          price: number;
          required?: boolean;
          scope?: Database['billing']['Enums']['fee_scope'];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          cycle?: Database['billing']['Enums']['fee_cycle'];
          icon?: string | null;
          id?: string;
          name?: string;
          name_ar?: string | null;
          price?: number;
          required?: boolean;
          scope?: Database['billing']['Enums']['fee_scope'];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      installment_plans: {
        Row: {
          child_id: string;
          created_at: string;
          fee_item_id: string;
          id: string;
          installment_count: number;
          label: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          fee_item_id: string;
          id?: string;
          installment_count: number;
          label: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          fee_item_id?: string;
          id?: string;
          installment_count?: number;
          label?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'installment_plans_fee_item_id_fkey';
            columns: ['fee_item_id'];
            isOneToOne: false;
            referencedRelation: 'fee_items';
            referencedColumns: ['id'];
          },
        ];
      };
      installment_schedule_entries: {
        Row: {
          amount: number;
          created_at: string;
          due_date: string;
          id: string;
          label: string;
          paid: boolean;
          paid_at: string | null;
          plan_id: string;
          sequence: number;
          status: Database['billing']['Enums']['billing_status'];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          due_date: string;
          id?: string;
          label: string;
          paid?: boolean;
          paid_at?: string | null;
          plan_id: string;
          sequence: number;
          status?: Database['billing']['Enums']['billing_status'];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          due_date?: string;
          id?: string;
          label?: string;
          paid?: boolean;
          paid_at?: string | null;
          plan_id?: string;
          sequence?: number;
          status?: Database['billing']['Enums']['billing_status'];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'installment_schedule_entries_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'installment_plans';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_lines: {
        Row: {
          amount: number;
          created_at: string;
          description: string;
          fee_item_id: string | null;
          id: string;
          installment_entry_id: string | null;
          invoice_id: string;
          ledger_item_id: string | null;
          tenant_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          description: string;
          fee_item_id?: string | null;
          id?: string;
          installment_entry_id?: string | null;
          invoice_id: string;
          ledger_item_id?: string | null;
          tenant_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          description?: string;
          fee_item_id?: string | null;
          id?: string;
          installment_entry_id?: string | null;
          invoice_id?: string;
          ledger_item_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invoice_lines_fee_item_id_fkey';
            columns: ['fee_item_id'];
            isOneToOne: false;
            referencedRelation: 'fee_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_lines_installment_entry_id_fkey';
            columns: ['installment_entry_id'];
            isOneToOne: false;
            referencedRelation: 'installment_schedule_entries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_lines_invoice_id_fkey';
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoice_lines_ledger_item_id_fkey';
            columns: ['ledger_item_id'];
            isOneToOne: false;
            referencedRelation: 'billing_ledger_items';
            referencedColumns: ['id'];
          },
        ];
      };
      invoice_number_counters: {
        Row: {
          next_number: number;
          tenant_id: string;
          year: number;
        };
        Insert: {
          next_number?: number;
          tenant_id: string;
          year: number;
        };
        Update: {
          next_number?: number;
          tenant_id?: string;
          year?: number;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          child_id: string;
          created_at: string;
          id: string;
          invoice_number: string;
          issued_at: string;
          pdf_object_id: string | null;
          status: Database['billing']['Enums']['invoice_status'];
          tenant_id: string;
          total: number;
          updated_at: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          id?: string;
          invoice_number: string;
          issued_at?: string;
          pdf_object_id?: string | null;
          status?: Database['billing']['Enums']['invoice_status'];
          tenant_id: string;
          total: number;
          updated_at?: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          id?: string;
          invoice_number?: string;
          issued_at?: string;
          pdf_object_id?: string | null;
          status?: Database['billing']['Enums']['invoice_status'];
          tenant_id?: string;
          total?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_transactions: {
        Row: {
          amount: number;
          child_id: string;
          id: string;
          initiated_at: string;
          invoice_id: string | null;
          method: Database['billing']['Enums']['payment_method'];
          provider_reference: string | null;
          receipt_file_path: string | null;
          receipt_object_id: string | null;
          settled_at: string | null;
          status: Database['billing']['Enums']['payment_status'];
          tenant_id: string;
        };
        Insert: {
          amount: number;
          child_id: string;
          id?: string;
          initiated_at?: string;
          invoice_id?: string | null;
          method: Database['billing']['Enums']['payment_method'];
          provider_reference?: string | null;
          receipt_file_path?: string | null;
          receipt_object_id?: string | null;
          settled_at?: string | null;
          status?: Database['billing']['Enums']['payment_status'];
          tenant_id: string;
        };
        Update: {
          amount?: number;
          child_id?: string;
          id?: string;
          initiated_at?: string;
          invoice_id?: string | null;
          method?: Database['billing']['Enums']['payment_method'];
          provider_reference?: string | null;
          receipt_file_path?: string | null;
          receipt_object_id?: string | null;
          settled_at?: string | null;
          status?: Database['billing']['Enums']['payment_status'];
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_transactions_invoice_id_fkey';
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      escalate_stale_pending_verifications: { Args: never; Returns: number };
      generate_recurring_ledger_items: { Args: never; Returns: number };
      roll_up_billing_status: { Args: never; Returns: number };
      send_payment_reminders: { Args: never; Returns: number };
      settle_payment_transaction: {
        Args: {
          p_actor_staff_id?: string;
          p_new_status: Database['billing']['Enums']['payment_status'];
          p_payment_transaction_id: string;
        };
        Returns: {
          amount: number;
          child_id: string;
          id: string;
          initiated_at: string;
          invoice_id: string | null;
          method: Database['billing']['Enums']['payment_method'];
          provider_reference: string | null;
          receipt_file_path: string | null;
          receipt_object_id: string | null;
          settled_at: string | null;
          status: Database['billing']['Enums']['payment_status'];
          tenant_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'payment_transactions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      billing_status: 'unbilled' | 'due' | 'partially_paid' | 'paid' | 'overdue';
      fee_cycle: 'monthly' | 'per_term' | 'once_per_year' | 'one_time';
      fee_scope: 'all' | 'optional';
      invoice_status: 'unpaid' | 'paid' | 'void';
      payment_method: 'bank_transfer' | 'instapay' | 'wallet' | 'fawry';
      payment_status: 'initiated' | 'pending_verification' | 'succeeded' | 'failed' | 'refunded';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  comms: {
    Tables: {
      announcement_recipients: {
        Row: {
          announcement_id: string;
          delivered_at: string | null;
          read_at: string | null;
          recipient_id: string;
          recipient_type: Database['comms']['Enums']['announcement_recipient_type'];
        };
        Insert: {
          announcement_id: string;
          delivered_at?: string | null;
          read_at?: string | null;
          recipient_id: string;
          recipient_type: Database['comms']['Enums']['announcement_recipient_type'];
        };
        Update: {
          announcement_id?: string;
          delivered_at?: string | null;
          read_at?: string | null;
          recipient_id?: string;
          recipient_type?: Database['comms']['Enums']['announcement_recipient_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'announcement_recipients_announcement_id_fkey';
            columns: ['announcement_id'];
            isOneToOne: false;
            referencedRelation: 'announcements';
            referencedColumns: ['id'];
          },
        ];
      };
      announcements: {
        Row: {
          audience: Database['comms']['Enums']['announcement_audience'] | null;
          body: string;
          channels: Database['comms']['Enums']['announcement_channel'][];
          classroom_id: string | null;
          created_at: string;
          created_by: string;
          id: string;
          platform_audience: Database['comms']['Enums']['platform_announcement_audience'] | null;
          priority: Database['comms']['Enums']['announcement_priority'];
          scheduled_for: string | null;
          sent_at: string | null;
          tenant_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          audience?: Database['comms']['Enums']['announcement_audience'] | null;
          body: string;
          channels?: Database['comms']['Enums']['announcement_channel'][];
          classroom_id?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          platform_audience?: Database['comms']['Enums']['platform_announcement_audience'] | null;
          priority?: Database['comms']['Enums']['announcement_priority'];
          scheduled_for?: string | null;
          sent_at?: string | null;
          tenant_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          audience?: Database['comms']['Enums']['announcement_audience'] | null;
          body?: string;
          channels?: Database['comms']['Enums']['announcement_channel'][];
          classroom_id?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          platform_audience?: Database['comms']['Enums']['platform_announcement_audience'] | null;
          priority?: Database['comms']['Enums']['announcement_priority'];
          scheduled_for?: string | null;
          sent_at?: string | null;
          tenant_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          child_id: string;
          created_at: string;
          escalated_at: string | null;
          escalation_reason: string | null;
          guardian_id: string;
          id: string;
          staff_id: string;
          status: Database['comms']['Enums']['conversation_status'];
          subject_id: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          escalated_at?: string | null;
          escalation_reason?: string | null;
          guardian_id: string;
          id?: string;
          staff_id: string;
          status?: Database['comms']['Enums']['conversation_status'];
          subject_id?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          escalated_at?: string | null;
          escalation_reason?: string | null;
          guardian_id?: string;
          id?: string;
          staff_id?: string;
          status?: Database['comms']['Enums']['conversation_status'];
          subject_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      device_tokens: {
        Row: {
          created_at: string;
          id: string;
          last_seen_at: string;
          platform: Database['comms']['Enums']['device_platform'];
          recipient_id: string;
          recipient_type: Database['comms']['Enums']['notification_recipient_type'];
          tenant_id: string | null;
          token: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_seen_at?: string;
          platform: Database['comms']['Enums']['device_platform'];
          recipient_id: string;
          recipient_type: Database['comms']['Enums']['notification_recipient_type'];
          tenant_id?: string | null;
          token: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_seen_at?: string;
          platform?: Database['comms']['Enums']['device_platform'];
          recipient_id?: string;
          recipient_type?: Database['comms']['Enums']['notification_recipient_type'];
          tenant_id?: string | null;
          token?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          body: string;
          conversation_id: string;
          id: string;
          read_at: string | null;
          sender_id: string | null;
          sender_type: Database['comms']['Enums']['message_sender_type'];
          sent_at: string;
          tenant_id: string;
        };
        Insert: {
          body: string;
          conversation_id: string;
          id?: string;
          read_at?: string | null;
          sender_id?: string | null;
          sender_type: Database['comms']['Enums']['message_sender_type'];
          sent_at?: string;
          tenant_id: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          id?: string;
          read_at?: string | null;
          sender_id?: string | null;
          sender_type?: Database['comms']['Enums']['message_sender_type'];
          sent_at?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_deliveries: {
        Row: {
          channel: Database['comms']['Enums']['notification_channel'];
          failed_reason: string | null;
          id: string;
          notification_id: string;
          provider_message_id: string | null;
          sent_at: string | null;
          status: Database['comms']['Enums']['notification_delivery_status'];
        };
        Insert: {
          channel: Database['comms']['Enums']['notification_channel'];
          failed_reason?: string | null;
          id?: string;
          notification_id: string;
          provider_message_id?: string | null;
          sent_at?: string | null;
          status?: Database['comms']['Enums']['notification_delivery_status'];
        };
        Update: {
          channel?: Database['comms']['Enums']['notification_channel'];
          failed_reason?: string | null;
          id?: string;
          notification_id?: string;
          provider_message_id?: string | null;
          sent_at?: string | null;
          status?: Database['comms']['Enums']['notification_delivery_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'notification_deliveries_notification_id_fkey';
            columns: ['notification_id'];
            isOneToOne: false;
            referencedRelation: 'notifications';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_preferences: {
        Row: {
          category: string;
          channel: Database['comms']['Enums']['notification_channel'];
          enabled: boolean;
          id: string;
          recipient_id: string;
          recipient_type: Database['comms']['Enums']['notification_recipient_type'];
          tenant_id: string | null;
        };
        Insert: {
          category: string;
          channel: Database['comms']['Enums']['notification_channel'];
          enabled?: boolean;
          id?: string;
          recipient_id: string;
          recipient_type: Database['comms']['Enums']['notification_recipient_type'];
          tenant_id?: string | null;
        };
        Update: {
          category?: string;
          channel?: Database['comms']['Enums']['notification_channel'];
          enabled?: boolean;
          id?: string;
          recipient_id?: string;
          recipient_type?: Database['comms']['Enums']['notification_recipient_type'];
          tenant_id?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string;
          category: string;
          created_at: string;
          deep_link: string | null;
          id: string;
          read_at: string | null;
          recipient_id: string;
          recipient_type: Database['comms']['Enums']['notification_recipient_type'];
          severity: Database['comms']['Enums']['notification_severity'];
          tenant_id: string | null;
          title: string;
        };
        Insert: {
          body: string;
          category: string;
          created_at?: string;
          deep_link?: string | null;
          id?: string;
          read_at?: string | null;
          recipient_id: string;
          recipient_type: Database['comms']['Enums']['notification_recipient_type'];
          severity?: Database['comms']['Enums']['notification_severity'];
          tenant_id?: string | null;
          title: string;
        };
        Update: {
          body?: string;
          category?: string;
          created_at?: string;
          deep_link?: string | null;
          id?: string;
          read_at?: string | null;
          recipient_id?: string;
          recipient_type?: Database['comms']['Enums']['notification_recipient_type'];
          severity?: Database['comms']['Enums']['notification_severity'];
          tenant_id?: string | null;
          title?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      enqueue_notification: {
        Args: {
          p_body: string;
          p_category: string;
          p_deep_link?: string;
          p_recipient_id: string;
          p_recipient_type: Database['comms']['Enums']['notification_recipient_type'];
          p_severity?: Database['comms']['Enums']['notification_severity'];
          p_tenant_id: string;
          p_title: string;
        };
        Returns: {
          body: string;
          category: string;
          created_at: string;
          deep_link: string | null;
          id: string;
          read_at: string | null;
          recipient_id: string;
          recipient_type: Database['comms']['Enums']['notification_recipient_type'];
          severity: Database['comms']['Enums']['notification_severity'];
          tenant_id: string | null;
          title: string;
        };
        SetofOptions: {
          from: '*';
          to: 'notifications';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      announcement_audience: 'all' | 'parents' | 'classroom' | 'teachers' | 'drivers';
      announcement_channel: 'push' | 'whatsapp' | 'sms' | 'email' | 'in_app';
      announcement_priority: 'normal' | 'important' | 'urgent';
      announcement_recipient_type: 'guardian' | 'staff' | 'driver' | 'tenant';
      conversation_status: 'open' | 'escalated' | 'closed';
      device_platform: 'ios' | 'android' | 'web';
      message_sender_type: 'guardian' | 'staff' | 'system';
      notification_channel: 'push' | 'whatsapp' | 'sms' | 'email' | 'in_app';
      notification_delivery_status: 'queued' | 'sent' | 'delivered' | 'failed' | 'skipped_by_preference';
      notification_recipient_type: 'guardian' | 'staff' | 'driver' | 'platform_admin';
      notification_severity: 'info' | 'attention' | 'urgent';
      platform_announcement_audience: 'all_schools' | 'plan_tier' | 'overdue_accounts' | 'trial_accounts';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  identity: {
    Tables: {
      driver_profiles: {
        Row: {
          bus_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          name: string;
          name_ar: string | null;
          national_id: string | null;
          phone: string;
          photo_object_id: string | null;
          preferred_language: Database['identity']['Enums']['language'];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          bus_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id: string;
          name: string;
          name_ar?: string | null;
          national_id?: string | null;
          phone: string;
          photo_object_id?: string | null;
          preferred_language?: Database['identity']['Enums']['language'];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          bus_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          name_ar?: string | null;
          national_id?: string | null;
          phone?: string;
          photo_object_id?: string | null;
          preferred_language?: Database['identity']['Enums']['language'];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'driver_profiles_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'staff_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      guardian_profiles: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          email: string | null;
          id: string;
          name: string;
          name_ar: string | null;
          national_id: string | null;
          phone: string;
          photo_object_id: string | null;
          preferred_language: Database['identity']['Enums']['language'];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          id: string;
          name: string;
          name_ar?: string | null;
          national_id?: string | null;
          phone: string;
          photo_object_id?: string | null;
          preferred_language?: Database['identity']['Enums']['language'];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          name_ar?: string | null;
          national_id?: string | null;
          phone?: string;
          photo_object_id?: string | null;
          preferred_language?: Database['identity']['Enums']['language'];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'guardian_profiles_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'staff_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_admins: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          email: string;
          id: string;
          name: string;
          role: Database['identity']['Enums']['platform_admin_tier'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          id: string;
          name: string;
          role?: Database['identity']['Enums']['platform_admin_tier'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          id?: string;
          name?: string;
          role?: Database['identity']['Enums']['platform_admin_tier'];
          updated_at?: string;
        };
        Relationships: [];
      };
      service_accounts: {
        Row: {
          api_key_hash: string;
          id: string;
          issued_at: string;
          issued_by: string | null;
          last_used_at: string | null;
          name: string;
          purpose: Database['identity']['Enums']['service_account_purpose'];
          revoked_at: string | null;
          scopes: string[];
          status: Database['identity']['Enums']['service_account_status'];
          tenant_id: string | null;
        };
        Insert: {
          api_key_hash: string;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          last_used_at?: string | null;
          name: string;
          purpose: Database['identity']['Enums']['service_account_purpose'];
          revoked_at?: string | null;
          scopes?: string[];
          status?: Database['identity']['Enums']['service_account_status'];
          tenant_id?: string | null;
        };
        Update: {
          api_key_hash?: string;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          last_used_at?: string | null;
          name?: string;
          purpose?: Database['identity']['Enums']['service_account_purpose'];
          revoked_at?: string | null;
          scopes?: string[];
          status?: Database['identity']['Enums']['service_account_status'];
          tenant_id?: string | null;
        };
        Relationships: [];
      };
      staff_feedback: {
        Row: {
          body: string;
          created_at: string;
          from_name: string;
          id: string;
          kind: Database['identity']['Enums']['feedback_kind'];
          occurred_at: string;
          severity: Database['identity']['Enums']['feedback_severity'] | null;
          staff_profile_id: string;
          subject: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          from_name: string;
          id?: string;
          kind: Database['identity']['Enums']['feedback_kind'];
          occurred_at?: string;
          severity?: Database['identity']['Enums']['feedback_severity'] | null;
          staff_profile_id: string;
          subject?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          from_name?: string;
          id?: string;
          kind?: Database['identity']['Enums']['feedback_kind'];
          occurred_at?: string;
          severity?: Database['identity']['Enums']['feedback_severity'] | null;
          staff_profile_id?: string;
          subject?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_feedback_staff_profile_id_fkey';
            columns: ['staff_profile_id'];
            isOneToOne: false;
            referencedRelation: 'staff_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      staff_leave_records: {
        Row: {
          covering_staff_id: string | null;
          created_at: string;
          from_date: string;
          id: string;
          reason: string | null;
          staff_profile_id: string;
          tenant_id: string;
          to_date: string;
          updated_at: string;
        };
        Insert: {
          covering_staff_id?: string | null;
          created_at?: string;
          from_date: string;
          id?: string;
          reason?: string | null;
          staff_profile_id: string;
          tenant_id: string;
          to_date: string;
          updated_at?: string;
        };
        Update: {
          covering_staff_id?: string | null;
          created_at?: string;
          from_date?: string;
          id?: string;
          reason?: string | null;
          staff_profile_id?: string;
          tenant_id?: string;
          to_date?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_leave_records_covering_staff_id_fkey';
            columns: ['covering_staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_leave_records_staff_profile_id_fkey';
            columns: ['staff_profile_id'];
            isOneToOne: false;
            referencedRelation: 'staff_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      staff_profiles: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          email: string | null;
          employment_status: Database['identity']['Enums']['employment_status'];
          id: string;
          join_date: string;
          name: string;
          name_ar: string | null;
          national_id: string | null;
          phone: string;
          photo_object_id: string | null;
          preferred_language: Database['identity']['Enums']['language'];
          primary_classroom_id: string | null;
          rating: number | null;
          role: Database['identity']['Enums']['staff_role'];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          employment_status?: Database['identity']['Enums']['employment_status'];
          id: string;
          join_date?: string;
          name: string;
          name_ar?: string | null;
          national_id?: string | null;
          phone: string;
          photo_object_id?: string | null;
          preferred_language?: Database['identity']['Enums']['language'];
          primary_classroom_id?: string | null;
          rating?: number | null;
          role: Database['identity']['Enums']['staff_role'];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          employment_status?: Database['identity']['Enums']['employment_status'];
          id?: string;
          join_date?: string;
          name?: string;
          name_ar?: string | null;
          national_id?: string | null;
          phone?: string;
          photo_object_id?: string | null;
          preferred_language?: Database['identity']['Enums']['language'];
          primary_classroom_id?: string | null;
          rating?: number | null;
          role?: Database['identity']['Enums']['staff_role'];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_profiles_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'staff_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      staff_subjects: {
        Row: {
          days: string[];
          sessions_per_week: number;
          staff_profile_id: string;
          subject_id: string;
          tenant_id: string;
        };
        Insert: {
          days?: string[];
          sessions_per_week?: number;
          staff_profile_id: string;
          subject_id: string;
          tenant_id: string;
        };
        Update: {
          days?: string[];
          sessions_per_week?: number;
          staff_profile_id?: string;
          subject_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_subjects_staff_profile_id_fkey';
            columns: ['staff_profile_id'];
            isOneToOne: false;
            referencedRelation: 'staff_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      run_staff_rating_recomputation: { Args: never; Returns: number };
    };
    Enums: {
      employment_status: 'active' | 'on_leave' | 'terminated';
      feedback_kind: 'complaint' | 'commend';
      feedback_severity: 'low' | 'medium' | 'high';
      language: 'en' | 'ar';
      platform_admin_tier: 'owner' | 'admin' | 'support';
      service_account_purpose: 'camera_agent' | 'integration_other';
      service_account_status: 'active' | 'revoked';
      staff_role: 'manager' | 'teacher' | 'reception';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  jobs: {
    Tables: {
      background_job_queue: {
        Row: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          id: string;
          job_type: string;
          last_error: string | null;
          max_attempts: number;
          next_attempt_at: string;
          payload: Json;
          status: Database['jobs']['Enums']['background_job_status'];
        };
        Insert: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          job_type: string;
          last_error?: string | null;
          max_attempts?: number;
          next_attempt_at?: string;
          payload?: Json;
          status?: Database['jobs']['Enums']['background_job_status'];
        };
        Update: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          job_type?: string;
          last_error?: string | null;
          max_attempts?: number;
          next_attempt_at?: string;
          payload?: Json;
          status?: Database['jobs']['Enums']['background_job_status'];
        };
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          caller_id: string | null;
          created_at: string;
          key: string;
          response_snapshot: Json;
          rpc_name: string;
          tenant_id: string | null;
        };
        Insert: {
          caller_id?: string | null;
          created_at?: string;
          key: string;
          response_snapshot: Json;
          rpc_name: string;
          tenant_id?: string | null;
        };
        Update: {
          caller_id?: string | null;
          created_at?: string;
          key?: string;
          response_snapshot?: Json;
          rpc_name?: string;
          tenant_id?: string | null;
        };
        Relationships: [];
      };
      scheduled_job_runs: {
        Row: {
          error: string | null;
          finished_at: string | null;
          id: string;
          job_name: string;
          rows_affected: number | null;
          started_at: string;
          status: Database['jobs']['Enums']['scheduled_job_run_status'];
        };
        Insert: {
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          job_name: string;
          rows_affected?: number | null;
          started_at?: string;
          status?: Database['jobs']['Enums']['scheduled_job_run_status'];
        };
        Update: {
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          job_name?: string;
          rows_affected?: number | null;
          started_at?: string;
          status?: Database['jobs']['Enums']['scheduled_job_run_status'];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_background_jobs: {
        Args: { p_batch_size?: number; p_job_type: string };
        Returns: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          id: string;
          job_type: string;
          last_error: string | null;
          max_attempts: number;
          next_attempt_at: string;
          payload: Json;
          status: Database['jobs']['Enums']['background_job_status'];
        }[];
        SetofOptions: {
          from: '*';
          to: 'background_job_queue';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      record_scheduled_job_run: {
        Args: {
          p_error?: string;
          p_job_name: string;
          p_rows_affected?: number;
          p_started_at: string;
          p_status: Database['jobs']['Enums']['scheduled_job_run_status'];
        };
        Returns: string;
      };
      register_scheduled_jobs: { Args: never; Returns: number };
      run_idempotency_key_purge: {
        Args: { p_retention_hours?: number };
        Returns: number;
      };
    };
    Enums: {
      background_job_status: 'queued' | 'processing' | 'succeeded' | 'failed';
      scheduled_job_run_status: 'running' | 'succeeded' | 'failed';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  media: {
    Tables: {
      camera_classroom_links: {
        Row: {
          camera_id: string;
          classroom_id: string;
          created_at: string;
          tenant_id: string;
        };
        Insert: {
          camera_id: string;
          classroom_id: string;
          created_at?: string;
          tenant_id: string;
        };
        Update: {
          camera_id?: string;
          classroom_id?: string;
          created_at?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'camera_classroom_links_camera_id_fkey';
            columns: ['camera_id'];
            isOneToOne: false;
            referencedRelation: 'cameras';
            referencedColumns: ['id'];
          },
        ];
      };
      camera_connections: {
        Row: {
          camera_id: string;
          created_at: string;
          ip_address: unknown;
          stream_protocol: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          camera_id: string;
          created_at?: string;
          ip_address: unknown;
          stream_protocol: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          camera_id?: string;
          created_at?: string;
          ip_address?: unknown;
          stream_protocol?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'camera_connections_camera_id_fkey';
            columns: ['camera_id'];
            isOneToOne: true;
            referencedRelation: 'cameras';
            referencedColumns: ['id'];
          },
        ];
      };
      camera_service_account_links: {
        Row: {
          camera_id: string;
          created_at: string;
          service_account_id: string;
          tenant_id: string;
        };
        Insert: {
          camera_id: string;
          created_at?: string;
          service_account_id: string;
          tenant_id: string;
        };
        Update: {
          camera_id?: string;
          created_at?: string;
          service_account_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'camera_service_account_links_camera_id_fkey';
            columns: ['camera_id'];
            isOneToOne: false;
            referencedRelation: 'cameras';
            referencedColumns: ['id'];
          },
        ];
      };
      cameras: {
        Row: {
          added_at: string;
          admin_disabled: boolean;
          created_at: string;
          deleted_at: string | null;
          has_audio: boolean;
          id: string;
          last_heartbeat_at: string | null;
          name: string;
          online: boolean;
          resolution: Database['media']['Enums']['camera_resolution'];
          tenant_id: string;
          updated_at: string;
          zone: Database['media']['Enums']['camera_zone'];
        };
        Insert: {
          added_at?: string;
          admin_disabled?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          has_audio?: boolean;
          id?: string;
          last_heartbeat_at?: string | null;
          name: string;
          online?: boolean;
          resolution: Database['media']['Enums']['camera_resolution'];
          tenant_id: string;
          updated_at?: string;
          zone: Database['media']['Enums']['camera_zone'];
        };
        Update: {
          added_at?: string;
          admin_disabled?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          has_audio?: boolean;
          id?: string;
          last_heartbeat_at?: string | null;
          name?: string;
          online?: boolean;
          resolution?: Database['media']['Enums']['camera_resolution'];
          tenant_id?: string;
          updated_at?: string;
          zone?: Database['media']['Enums']['camera_zone'];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      sweep_camera_heartbeats: { Args: never; Returns: number };
    };
    Enums: {
      camera_resolution: '720p' | '1080p' | '4k';
      camera_zone: 'classroom' | 'outdoor' | 'rest' | 'entrance' | 'common';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  platform: {
    Tables: {
      activity_log: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_type: Database['platform']['Enums']['activity_actor_type'];
          id: string;
          metadata: Json;
          occurred_at: string;
          target_id: string | null;
          target_type: string;
          tenant_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_type: Database['platform']['Enums']['activity_actor_type'];
          id?: string;
          metadata?: Json;
          occurred_at?: string;
          target_id?: string | null;
          target_type: string;
          tenant_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_type?: Database['platform']['Enums']['activity_actor_type'];
          id?: string;
          metadata?: Json;
          occurred_at?: string;
          target_id?: string | null;
          target_type?: string;
          tenant_id?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_type: Database['platform']['Enums']['audit_actor_type'];
          id: string;
          ip_address: unknown;
          occurred_at: string;
          target_id: string | null;
          target_type: string;
          tenant_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_type: Database['platform']['Enums']['audit_actor_type'];
          id?: string;
          ip_address?: unknown;
          occurred_at?: string;
          target_id?: string | null;
          target_type: string;
          tenant_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_type?: Database['platform']['Enums']['audit_actor_type'];
          id?: string;
          ip_address?: unknown;
          occurred_at?: string;
          target_id?: string | null;
          target_type?: string;
          tenant_id?: string | null;
        };
        Relationships: [];
      };
      notification_outbox: {
        Row: {
          category: string;
          created_at: string;
          dispatched_at: string | null;
          id: string;
          payload: Json;
          recipient_id: string;
          recipient_type: string;
          tenant_id: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          dispatched_at?: string | null;
          id?: string;
          payload?: Json;
          recipient_id: string;
          recipient_type: string;
          tenant_id: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          dispatched_at?: string | null;
          id?: string;
          payload?: Json;
          recipient_id?: string;
          recipient_type?: string;
          tenant_id?: string;
        };
        Relationships: [];
      };
      service_health_status: {
        Row: {
          checked_at: string;
          id: string;
          latency_ms: number;
          service_code: string;
          status: Database['platform']['Enums']['service_status'];
          uptime_pct: number;
        };
        Insert: {
          checked_at?: string;
          id?: string;
          latency_ms: number;
          service_code: string;
          status: Database['platform']['Enums']['service_status'];
          uptime_pct: number;
        };
        Update: {
          checked_at?: string;
          id?: string;
          latency_ms?: number;
          service_code?: string;
          status?: Database['platform']['Enums']['service_status'];
          uptime_pct?: number;
        };
        Relationships: [];
      };
      support_tickets: {
        Row: {
          assigned_to: string | null;
          body: string;
          category: Database['platform']['Enums']['support_ticket_category'];
          created_at: string;
          id: string;
          reported_by: string;
          resolved_at: string | null;
          severity: Database['platform']['Enums']['support_ticket_severity'];
          status: Database['platform']['Enums']['support_ticket_status'];
          subject: string;
          tenant_id: string;
        };
        Insert: {
          assigned_to?: string | null;
          body: string;
          category: Database['platform']['Enums']['support_ticket_category'];
          created_at?: string;
          id?: string;
          reported_by: string;
          resolved_at?: string | null;
          severity: Database['platform']['Enums']['support_ticket_severity'];
          status?: Database['platform']['Enums']['support_ticket_status'];
          subject: string;
          tenant_id: string;
        };
        Update: {
          assigned_to?: string | null;
          body?: string;
          category?: Database['platform']['Enums']['support_ticket_category'];
          created_at?: string;
          id?: string;
          reported_by?: string;
          resolved_at?: string | null;
          severity?: Database['platform']['Enums']['support_ticket_severity'];
          status?: Database['platform']['Enums']['support_ticket_status'];
          subject?: string;
          tenant_id?: string;
        };
        Relationships: [];
      };
      tenant_billing_transactions: {
        Row: {
          amount: number;
          currency: string;
          id: string;
          initiated_at: string;
          invoice_object_id: string | null;
          kind: Database['platform']['Enums']['billing_transaction_kind'];
          provider_reference: string | null;
          settled_at: string | null;
          status: Database['platform']['Enums']['billing_transaction_status'];
          tenant_id: string;
        };
        Insert: {
          amount: number;
          currency?: string;
          id?: string;
          initiated_at?: string;
          invoice_object_id?: string | null;
          kind: Database['platform']['Enums']['billing_transaction_kind'];
          provider_reference?: string | null;
          settled_at?: string | null;
          status?: Database['platform']['Enums']['billing_transaction_status'];
          tenant_id: string;
        };
        Update: {
          amount?: number;
          currency?: string;
          id?: string;
          initiated_at?: string;
          invoice_object_id?: string | null;
          kind?: Database['platform']['Enums']['billing_transaction_kind'];
          provider_reference?: string | null;
          settled_at?: string | null;
          status?: Database['platform']['Enums']['billing_transaction_status'];
          tenant_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_tenant_billing_summary: {
        Row: {
          computed_at: string | null;
          failed_charge_count: number | null;
          gross_succeeded_amount: number | null;
          last_transaction_at: string | null;
          net_succeeded_amount: number | null;
          refunded_amount: number | null;
          succeeded_charge_count: number | null;
          tenant_id: string | null;
          tenant_name: string | null;
          tenant_status: Database['tenancy']['Enums']['tenant_status'] | null;
        };
        Relationships: [];
      };
      v_tenant_health_summary: {
        Row: {
          active_children: number | null;
          active_staff: number | null;
          cameras_total: number | null;
          cameras_viewable: number | null;
          computed_at: string | null;
          open_support_tickets: number | null;
          tenant_id: string | null;
          tenant_name: string | null;
          tenant_status: Database['tenancy']['Enums']['tenant_status'] | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      drain_notification_outbox: { Args: never; Returns: number };
      run_activity_log_archival: {
        Args: { p_retention_days?: number };
        Returns: number;
      };
      run_attendance_non_marking_alert: { Args: never; Returns: number };
      run_failed_login_anomaly_sweep: {
        Args: { p_lookback_hours?: number; p_threshold?: number };
        Returns: number;
      };
      run_service_health_check: { Args: never; Returns: number };
      run_tenant_billing_check: { Args: never; Returns: number };
      run_trial_expiry_sweep: { Args: never; Returns: number };
      write_activity_log: {
        Args: {
          p_action: string;
          p_actor_id: string;
          p_actor_type: Database['platform']['Enums']['activity_actor_type'];
          p_metadata?: Json;
          p_target_id?: string;
          p_target_type: string;
          p_tenant_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      activity_actor_type: 'staff' | 'guardian' | 'driver' | 'system';
      audit_actor_type: 'platform_admin' | 'staff' | 'system';
      billing_transaction_kind: 'subscription_charge' | 'setup_fee' | 'refund';
      billing_transaction_status: 'initiated' | 'succeeded' | 'failed' | 'refunded';
      service_status: 'up' | 'degraded' | 'down';
      support_ticket_category: 'technical' | 'how_to' | 'request' | 'billing';
      support_ticket_severity: 'high' | 'med' | 'low';
      support_ticket_status: 'open' | 'in_progress' | 'resolved';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      advance_tenant_provisioning: {
        Args: {
          p_error?: string;
          p_step: Database['tenancy']['Enums']['provisioning_step'];
          p_tenant_id: string;
        };
        Returns: Database['tenancy']['Tables']['tenant_provisioning_state']['Row'];
        SetofOptions: {
          from: '*';
          to: 'tenant_provisioning_state';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      assign_bus_rider: {
        Args: {
          p_bus_id: string;
          p_child_id: string;
          p_pickup_address_override?: string;
        };
        Returns: Database['transport']['Tables']['bus_riders']['Row'];
        SetofOptions: {
          from: '*';
          to: 'bus_riders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      broadcast_announcement: {
        Args: {
          p_audience?: Database['comms']['Enums']['announcement_audience'];
          p_body: string;
          p_channels?: Database['comms']['Enums']['announcement_channel'][];
          p_classroom_id?: string;
          p_idempotency_key?: string;
          p_platform_audience?: Database['comms']['Enums']['platform_announcement_audience'];
          p_platform_plan_code?: string;
          p_priority?: Database['comms']['Enums']['announcement_priority'];
          p_title: string;
        };
        Returns: Database['comms']['Tables']['announcements']['Row'];
        SetofOptions: {
          from: '*';
          to: 'announcements';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cancel_trip_registration: {
        Args: { p_registration_id: string };
        Returns: Database['approvals']['Tables']['event_trip_registrations']['Row'];
        SetofOptions: {
          from: '*';
          to: 'event_trip_registrations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      complete_trip: {
        Args: { p_trip_id: string };
        Returns: Database['transport']['Tables']['trips']['Row'];
        SetofOptions: {
          from: '*';
          to: 'trips';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      confirm_handover: {
        Args: { p_pickup_scan_event_id: string };
        Returns: Database['safety']['Tables']['pickup_scan_events']['Row'];
        SetofOptions: {
          from: '*';
          to: 'pickup_scan_events';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_bus_with_driver_row: {
        Args: {
          p_capacity: number;
          p_driver_id: string;
          p_number: string;
          p_plate: string;
          p_service_area: string;
          p_tenant_id: string;
        };
        Returns: Database['transport']['Tables']['buses']['Row'];
        SetofOptions: {
          from: '*';
          to: 'buses';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_camera: {
        Args: {
          p_has_audio?: boolean;
          p_ip_address: unknown;
          p_name: string;
          p_resolution: Database['media']['Enums']['camera_resolution'];
          p_stream_protocol: string;
          p_zone: Database['media']['Enums']['camera_zone'];
        };
        Returns: Database['media']['Tables']['cameras']['Row'];
        SetofOptions: {
          from: '*';
          to: 'cameras';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_pickup_pass: {
        Args: {
          p_child_id: string;
          p_expires_at?: string;
          p_id_photo_object_id?: string;
          p_person_name: string;
          p_relation: Database['safety']['Enums']['pickup_person_relation'];
        };
        Returns: Database['safety']['Tables']['pickup_passes']['Row'];
        SetofOptions: {
          from: '*';
          to: 'pickup_passes';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_support_ticket: {
        Args: {
          p_body: string;
          p_category: Database['platform']['Enums']['support_ticket_category'];
          p_idempotency_key?: string;
          p_severity: Database['platform']['Enums']['support_ticket_severity'];
          p_subject: string;
        };
        Returns: Database['platform']['Tables']['support_tickets']['Row'];
        SetofOptions: {
          from: '*';
          to: 'support_tickets';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      current_account_is_active: { Args: never; Returns: boolean };
      current_driver_bus_ids: { Args: never; Returns: string[] };
      current_driver_rider_ids: { Args: never; Returns: string[] };
      current_driver_trip_ids: { Args: never; Returns: string[] };
      current_guardian_active_bus_ids: { Args: never; Returns: string[] };
      current_guardian_active_trip_ids: { Args: never; Returns: string[] };
      current_guardian_child_ids: { Args: never; Returns: string[] };
      current_guardian_classroom_ids: { Args: never; Returns: string[] };
      current_notification_recipient_type: {
        Args: never;
        Returns: Database['comms']['Enums']['notification_recipient_type'];
      };
      current_platform_admin_tier: {
        Args: never;
        Returns: Database['identity']['Enums']['platform_admin_tier'];
      };
      current_role: { Args: never; Returns: string };
      current_staff_classroom_ids: { Args: never; Returns: string[] };
      current_tenant_id: { Args: never; Returns: string };
      delete_report_draft: {
        Args: { p_draft_id: string; p_idempotency_key?: string };
        Returns: Json;
      };
      enroll_child_row: {
        Args: {
          p_child: Json;
          p_classroom_id: string;
          p_created_by: string;
          p_tenant_id: string;
        };
        Returns: Database['academic']['Tables']['children']['Row'];
        SetofOptions: {
          from: '*';
          to: 'children';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      enroll_child_with_guardian: {
        Args: {
          p_child: Json;
          p_classroom_id: string;
          p_created_by: string;
          p_guardian_id: string;
          p_is_primary_contact?: boolean;
          p_relation: Database['academic']['Enums']['guardian_relation'];
          p_tenant_id: string;
        };
        Returns: Database['academic']['Tables']['children']['Row'];
        SetofOptions: {
          from: '*';
          to: 'children';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      escalate_conversation: {
        Args: { p_conversation_id: string; p_reason?: string };
        Returns: Database['comms']['Tables']['conversations']['Row'];
        SetofOptions: {
          from: '*';
          to: 'conversations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      export_report_draft: {
        Args: { p_draft_id: string; p_idempotency_key?: string };
        Returns: Json;
      };
      generate_invoice: {
        Args: { p_child_id: string; p_idempotency_key?: string; p_items: Json };
        Returns: Database['billing']['Tables']['invoices']['Row'];
        SetofOptions: {
          from: '*';
          to: 'invoices';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      idempotency_replay: { Args: { p_key: string }; Returns: Json };
      idempotency_store: {
        Args: {
          p_caller_id: string;
          p_key: string;
          p_response: Json;
          p_rpc_name: string;
          p_tenant_id: string;
        };
        Returns: undefined;
      };
      is_platform_admin: { Args: never; Returns: boolean };
      is_platform_admin_manager_tier: { Args: never; Returns: boolean };
      issue_tenant_billing_transaction: {
        Args: {
          p_amount: number;
          p_currency?: string;
          p_idempotency_key?: string;
          p_kind: Database['platform']['Enums']['billing_transaction_kind'];
          p_provider_reference?: string;
          p_tenant_id: string;
        };
        Returns: Database['platform']['Tables']['tenant_billing_transactions']['Row'];
        SetofOptions: {
          from: '*';
          to: 'tenant_billing_transactions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      link_child_guardian: {
        Args: {
          p_child_id: string;
          p_guardian_id: string;
          p_is_primary_contact?: boolean;
          p_relation: Database['academic']['Enums']['guardian_relation'];
          p_tenant_id: string;
        };
        Returns: undefined;
      };
      mark_attendance: {
        Args: { p_classroom_id: string; p_date: string; p_records: Json };
        Returns: Json;
      };
      mark_installment_paid_manual: {
        Args: { p_installment_entry_id: string; p_note?: string };
        Returns: Database['billing']['Tables']['installment_schedule_entries']['Row'];
        SetofOptions: {
          from: '*';
          to: 'installment_schedule_entries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mark_ledger_item_paid_manual: {
        Args: { p_ledger_item_id: string; p_note?: string };
        Returns: Database['billing']['Tables']['billing_ledger_items']['Row'];
        SetofOptions: {
          from: '*';
          to: 'billing_ledger_items';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      payment_transactions_support_view: {
        Args: never;
        Returns: Database['billing']['Tables']['payment_transactions']['Row'][];
        SetofOptions: {
          from: '*';
          to: 'payment_transactions';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      reactivate_child: {
        Args: { p_child_id: string };
        Returns: Database['academic']['Tables']['children']['Row'];
        SetofOptions: {
          from: '*';
          to: 'children';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_gps_ping: {
        Args: {
          p_heading?: number;
          p_lat: number;
          p_lng: number;
          p_speed_kph?: number;
          p_trip_id: string;
        };
        Returns: Database['transport']['Tables']['gps_pings']['Row'];
        SetofOptions: {
          from: '*';
          to: 'gps_pings';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      refund_payment: {
        Args: {
          p_idempotency_key?: string;
          p_payment_transaction_id: string;
          p_reason?: string;
        };
        Returns: Database['billing']['Tables']['payment_transactions']['Row'];
        SetofOptions: {
          from: '*';
          to: 'payment_transactions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      refund_tenant_billing_transaction: {
        Args: {
          p_idempotency_key?: string;
          p_original_transaction_id: string;
          p_reason?: string;
        };
        Returns: Database['platform']['Tables']['tenant_billing_transactions']['Row'];
        SetofOptions: {
          from: '*';
          to: 'tenant_billing_transactions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      register_device_token: {
        Args: {
          p_platform: Database['comms']['Enums']['device_platform'];
          p_token: string;
        };
        Returns: Database['comms']['Tables']['device_tokens']['Row'];
        SetofOptions: {
          from: '*';
          to: 'device_tokens';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      resend_report_draft: {
        Args: { p_draft_id: string; p_idempotency_key?: string };
        Returns: Database['reports']['Tables']['ai_report_drafts']['Row'];
        SetofOptions: {
          from: '*';
          to: 'ai_report_drafts';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      review_request: {
        Args: {
          p_decision: 'PENDING' | 'SUCCESS' | 'ERROR';
          p_idempotency_key?: string;
          p_rejection_reason?: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      revoke_pickup_pass: {
        Args: { p_pickup_pass_id: string };
        Returns: Database['safety']['Tables']['pickup_passes']['Row'];
        SetofOptions: {
          from: '*';
          to: 'pickup_passes';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      scan_pickup_pass: { Args: { p_qr_token: string }; Returns: Json };
      schedule_report_draft: {
        Args: {
          p_draft_id: string;
          p_idempotency_key?: string;
          p_scheduled_for: string;
        };
        Returns: Database['reports']['Tables']['ai_report_drafts']['Row'];
        SetofOptions: {
          from: '*';
          to: 'ai_report_drafts';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      send_message: {
        Args: {
          p_body: string;
          p_child_id?: string;
          p_conversation_id?: string;
          p_idempotency_key?: string;
        };
        Returns: Database['comms']['Tables']['messages']['Row'];
        SetofOptions: {
          from: '*';
          to: 'messages';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      send_report_draft: {
        Args: { p_draft_id: string; p_idempotency_key?: string };
        Returns: Database['reports']['Tables']['ai_report_drafts']['Row'];
        SetofOptions: {
          from: '*';
          to: 'ai_report_drafts';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      start_trip: {
        Args: {
          p_bus_id: string;
          p_leg: Database['transport']['Enums']['trip_leg'];
        };
        Returns: Json;
      };
      submit_evaluation: {
        Args: {
          p_behavior: number;
          p_child_id: string;
          p_homework: Database['academic']['Enums']['homework_status'];
          p_lesson_id: string;
          p_note?: string;
          p_participation: number;
          p_understanding: number;
        };
        Returns: Database['academic']['Tables']['evaluations']['Row'];
        SetofOptions: {
          from: '*';
          to: 'evaluations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_request: {
        Args: {
          p_attachment_object_id?: string;
          p_classroom_id?: string;
          p_exam_kind?: Database['approvals']['Enums']['exam_kind'];
          p_idempotency_key?: string;
          p_note?: string;
          p_place?: string;
          p_price?: number;
          p_request_date: string;
          p_request_time?: string;
          p_subject_id?: string;
          p_title: string;
          p_type: Database['approvals']['Enums']['request_type'];
        };
        Returns: Database['approvals']['Tables']['requests']['Row'];
        SetofOptions: {
          from: '*';
          to: 'requests';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      suspend_child: {
        Args: { p_child_id: string; p_reason?: string };
        Returns: Database['academic']['Tables']['children']['Row'];
        SetofOptions: {
          from: '*';
          to: 'children';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      unassign_bus_rider: {
        Args: { p_bus_rider_id: string };
        Returns: Database['transport']['Tables']['bus_riders']['Row'];
        SetofOptions: {
          from: '*';
          to: 'bus_riders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_child_trip_status: {
        Args: {
          p_child_id: string;
          p_status: Database['transport']['Enums']['trip_child_status_value'];
          p_trip_id: string;
        };
        Returns: Database['transport']['Tables']['trip_child_status']['Row'];
        SetofOptions: {
          from: '*';
          to: 'trip_child_status';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_notification_preferences: {
        Args: {
          p_category: string;
          p_channel: Database['comms']['Enums']['notification_channel'];
          p_enabled: boolean;
        };
        Returns: Database['comms']['Tables']['notification_preferences']['Row'];
        SetofOptions: {
          from: '*';
          to: 'notification_preferences';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_rsvp: {
        Args: {
          p_attendee: Database['approvals']['Enums']['rsvp_attendee'];
          p_child_id: string;
          p_contact_phone?: string;
          p_event_id: string;
          p_extra_guest_name?: string;
          p_extra_guest_relation?: string;
        };
        Returns: Database['approvals']['Tables']['event_rsvps']['Row'];
        SetofOptions: {
          from: '*';
          to: 'event_rsvps';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_support_ticket: {
        Args: {
          p_assigned_to?: string;
          p_idempotency_key?: string;
          p_status?: Database['platform']['Enums']['support_ticket_status'];
          p_ticket_id: string;
        };
        Returns: Database['platform']['Tables']['support_tickets']['Row'];
        SetofOptions: {
          from: '*';
          to: 'support_tickets';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      verify_payment: {
        Args: {
          p_decision: Database['billing']['Enums']['payment_status'];
          p_idempotency_key?: string;
          p_note?: string;
          p_payment_transaction_id: string;
        };
        Returns: Database['billing']['Tables']['payment_transactions']['Row'];
        SetofOptions: {
          from: '*';
          to: 'payment_transactions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      withdraw_child: {
        Args: { p_child_id: string; p_reason?: string };
        Returns: Database['academic']['Tables']['children']['Row'];
        SetofOptions: {
          from: '*';
          to: 'children';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      write_audit_log: {
        Args: {
          p_action: string;
          p_actor_id: string;
          p_actor_type: Database['platform']['Enums']['audit_actor_type'];
          p_ip_address?: unknown;
          p_target_id?: string;
          p_target_type: string;
          p_tenant_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  reports: {
    Tables: {
      ai_report_batches: {
        Row: {
          classroom_id: string | null;
          created_at: string;
          created_by: string;
          id: string;
          scope: Database['reports']['Enums']['report_scope'];
          tenant_id: string;
          topic: string | null;
          type: Database['reports']['Enums']['report_type'];
        };
        Insert: {
          classroom_id?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          scope: Database['reports']['Enums']['report_scope'];
          tenant_id: string;
          topic?: string | null;
          type: Database['reports']['Enums']['report_type'];
        };
        Update: {
          classroom_id?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          scope?: Database['reports']['Enums']['report_scope'];
          tenant_id?: string;
          topic?: string | null;
          type?: Database['reports']['Enums']['report_type'];
        };
        Relationships: [];
      };
      ai_report_drafts: {
        Row: {
          batch_id: string;
          body: string;
          child_id: string;
          created_at: string;
          delivery_channels: Database['reports']['Enums']['delivery_channel'][];
          edited_by: string | null;
          id: string;
          metrics: Json;
          scheduled_for: string | null;
          sent_at: string | null;
          status: Database['reports']['Enums']['report_draft_status'];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          batch_id: string;
          body: string;
          child_id: string;
          created_at?: string;
          delivery_channels?: Database['reports']['Enums']['delivery_channel'][];
          edited_by?: string | null;
          id?: string;
          metrics?: Json;
          scheduled_for?: string | null;
          sent_at?: string | null;
          status?: Database['reports']['Enums']['report_draft_status'];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          batch_id?: string;
          body?: string;
          child_id?: string;
          created_at?: string;
          delivery_channels?: Database['reports']['Enums']['delivery_channel'][];
          edited_by?: string | null;
          id?: string;
          metrics?: Json;
          scheduled_for?: string | null;
          sent_at?: string | null;
          status?: Database['reports']['Enums']['report_draft_status'];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_report_drafts_batch_id_fkey';
            columns: ['batch_id'];
            isOneToOne: false;
            referencedRelation: 'ai_report_batches';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_usage_counters: {
        Row: {
          calls_used: number;
          id: string;
          tenant_id: string;
          usage_date: string;
        };
        Insert: {
          calls_used?: number;
          id?: string;
          tenant_id: string;
          usage_date: string;
        };
        Update: {
          calls_used?: number;
          id?: string;
          tenant_id?: string;
          usage_date?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_ai_report_batch: {
        Args: {
          p_caller_id: string;
          p_caller_role: string;
          p_child_ids: string[];
          p_classroom_id: string;
          p_drafts: Json;
          p_scope: Database['reports']['Enums']['report_scope'];
          p_tenant_id: string;
          p_topic: string;
          p_type: Database['reports']['Enums']['report_type'];
        };
        Returns: Json;
      };
      increment_ai_usage: { Args: { p_tenant_id: string }; Returns: number };
      sweep_scheduled_report_drafts: { Args: never; Returns: number };
    };
    Enums: {
      delivery_channel: 'app' | 'whatsapp' | 'email';
      report_draft_status: 'draft' | 'ready' | 'scheduled' | 'sent';
      report_scope: 'classroom' | 'children';
      report_type: 'monthly_progress' | 'subject_report' | 'behavior_social' | 'attendance_summary';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  safety: {
    Tables: {
      pickup_passes: {
        Row: {
          child_id: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          id_photo_object_id: string | null;
          person_name: string;
          qr_token: string;
          relation: Database['safety']['Enums']['pickup_person_relation'];
          status: Database['safety']['Enums']['pickup_pass_status'];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          created_by: string;
          expires_at: string;
          id?: string;
          id_photo_object_id?: string | null;
          person_name: string;
          qr_token: string;
          relation: Database['safety']['Enums']['pickup_person_relation'];
          status?: Database['safety']['Enums']['pickup_pass_status'];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          id_photo_object_id?: string | null;
          person_name?: string;
          qr_token?: string;
          relation?: Database['safety']['Enums']['pickup_person_relation'];
          status?: Database['safety']['Enums']['pickup_pass_status'];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pickup_scan_events: {
        Row: {
          handover_confirmed: boolean;
          id: string;
          pickup_pass_id: string | null;
          result: Database['safety']['Enums']['pickup_scan_result'];
          scanned_at: string;
          scanned_by: string;
          tenant_id: string;
        };
        Insert: {
          handover_confirmed?: boolean;
          id?: string;
          pickup_pass_id?: string | null;
          result: Database['safety']['Enums']['pickup_scan_result'];
          scanned_at?: string;
          scanned_by: string;
          tenant_id: string;
        };
        Update: {
          handover_confirmed?: boolean;
          id?: string;
          pickup_pass_id?: string | null;
          result?: Database['safety']['Enums']['pickup_scan_result'];
          scanned_at?: string;
          scanned_by?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pickup_scan_events_pickup_pass_id_fkey';
            columns: ['pickup_pass_id'];
            isOneToOne: false;
            referencedRelation: 'pickup_passes';
            referencedColumns: ['id'];
          },
        ];
      };
      pickup_scan_rate_limits: {
        Row: {
          attempt_count: number;
          scanned_by: string;
          window_started_at: string;
        };
        Insert: {
          attempt_count?: number;
          scanned_by: string;
          window_started_at?: string;
        };
        Update: {
          attempt_count?: number;
          scanned_by?: string;
          window_started_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      pickup_pass_status: 'active' | 'expired' | 'revoked';
      pickup_person_relation:
        | 'father'
        | 'mother'
        | 'uncle'
        | 'aunt'
        | 'grandfather'
        | 'grandmother'
        | 'sibling'
        | 'driver'
        | 'other';
      pickup_scan_result: 'valid' | 'invalid_expired' | 'invalid_unknown' | 'invalid_revoked';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  tenancy: {
    Tables: {
      plan_catalog: {
        Row: {
          ai_daily_call_cap: number;
          code: Database['tenancy']['Enums']['plan_code'];
          created_at: string;
          id: string;
          max_children: number | null;
          monthly_price: number;
          setup_fee: number;
          updated_at: string;
        };
        Insert: {
          ai_daily_call_cap?: number;
          code: Database['tenancy']['Enums']['plan_code'];
          created_at?: string;
          id?: string;
          max_children?: number | null;
          monthly_price: number;
          setup_fee: number;
          updated_at?: string;
        };
        Update: {
          ai_daily_call_cap?: number;
          code?: Database['tenancy']['Enums']['plan_code'];
          created_at?: string;
          id?: string;
          max_children?: number | null;
          monthly_price?: number;
          setup_fee?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      plan_catalog_apps: {
        Row: {
          app_code: Database['tenancy']['Enums']['app_code'];
          plan_id: string;
        };
        Insert: {
          app_code: Database['tenancy']['Enums']['app_code'];
          plan_id: string;
        };
        Update: {
          app_code?: Database['tenancy']['Enums']['app_code'];
          plan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_catalog_apps_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plan_catalog';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_phone_registry: {
        Row: {
          account_id: string;
          account_type: Database['tenancy']['Enums']['phone_account_type'];
          created_at: string;
          id: string;
          phone: string;
          tenant_id: string;
        };
        Insert: {
          account_id: string;
          account_type: Database['tenancy']['Enums']['phone_account_type'];
          created_at?: string;
          id?: string;
          phone: string;
          tenant_id: string;
        };
        Update: {
          account_id?: string;
          account_type?: Database['tenancy']['Enums']['phone_account_type'];
          created_at?: string;
          id?: string;
          phone?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_phone_registry_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_provisioning_state: {
        Row: {
          last_error: string | null;
          step: Database['tenancy']['Enums']['provisioning_step'];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          last_error?: string | null;
          step?: Database['tenancy']['Enums']['provisioning_step'];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          last_error?: string | null;
          step?: Database['tenancy']['Enums']['provisioning_step'];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_provisioning_state_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: true;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenants: {
        Row: {
          city: string | null;
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string;
          id: string;
          name: string;
          plan_id: string;
          slug: string;
          status: Database['tenancy']['Enums']['tenant_status'];
          suspended_at: string | null;
          suspended_reason: string | null;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          plan_id: string;
          slug: string;
          status?: Database['tenancy']['Enums']['tenant_status'];
          suspended_at?: string | null;
          suspended_reason?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          plan_id?: string;
          slug?: string;
          status?: Database['tenancy']['Enums']['tenant_status'];
          suspended_at?: string | null;
          suspended_reason?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenants_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plan_catalog';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      app_code: 'dashboard' | 'parent' | 'teacher' | 'reception' | 'driver';
      phone_account_type: 'staff' | 'guardian' | 'driver';
      plan_code: 'starter' | 'growth' | 'premium';
      provisioning_step:
        | 'created'
        | 'initial_manager_created'
        | 'plan_apps_provisioned'
        | 'welcome_sent'
        | 'complete';
      tenant_status: 'trial' | 'active' | 'overdue' | 'suspended';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  transport: {
    Tables: {
      bus_riders: {
        Row: {
          active: boolean;
          bus_id: string;
          child_id: string;
          created_at: string;
          id: string;
          pickup_address_override: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          bus_id: string;
          child_id: string;
          created_at?: string;
          id?: string;
          pickup_address_override?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          bus_id?: string;
          child_id?: string;
          created_at?: string;
          id?: string;
          pickup_address_override?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bus_riders_bus_id_fkey';
            columns: ['bus_id'];
            isOneToOne: false;
            referencedRelation: 'buses';
            referencedColumns: ['id'];
          },
        ];
      };
      buses: {
        Row: {
          capacity: number;
          created_at: string;
          deleted_at: string | null;
          driver_id: string | null;
          id: string;
          number: string;
          plate: string;
          service_area: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          capacity: number;
          created_at?: string;
          deleted_at?: string | null;
          driver_id?: string | null;
          id?: string;
          number: string;
          plate: string;
          service_area?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          capacity?: number;
          created_at?: string;
          deleted_at?: string | null;
          driver_id?: string | null;
          id?: string;
          number?: string;
          plate?: string;
          service_area?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gps_pings: {
        Row: {
          heading: number | null;
          id: string;
          lat: number;
          lng: number;
          recorded_at: string;
          speed_kph: number | null;
          tenant_id: string;
          trip_id: string;
        };
        Insert: {
          heading?: number | null;
          id?: string;
          lat: number;
          lng: number;
          recorded_at?: string;
          speed_kph?: number | null;
          tenant_id: string;
          trip_id: string;
        };
        Update: {
          heading?: number | null;
          id?: string;
          lat?: number;
          lng?: number;
          recorded_at?: string;
          speed_kph?: number | null;
          tenant_id?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gps_pings_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_child_status: {
        Row: {
          changed_by: string | null;
          child_id: string;
          created_at: string;
          id: string;
          status: Database['transport']['Enums']['trip_child_status_value'];
          status_changed_at: string | null;
          tenant_id: string;
          trip_id: string;
          updated_at: string;
        };
        Insert: {
          changed_by?: string | null;
          child_id: string;
          created_at?: string;
          id?: string;
          status?: Database['transport']['Enums']['trip_child_status_value'];
          status_changed_at?: string | null;
          tenant_id: string;
          trip_id: string;
          updated_at?: string;
        };
        Update: {
          changed_by?: string | null;
          child_id?: string;
          created_at?: string;
          id?: string;
          status?: Database['transport']['Enums']['trip_child_status_value'];
          status_changed_at?: string | null;
          tenant_id?: string;
          trip_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_child_status_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_stop_riders: {
        Row: {
          bus_rider_id: string;
          child_id: string;
          eta: string | null;
          tenant_id: string;
          trip_id: string;
          trip_stop_id: string;
        };
        Insert: {
          bus_rider_id: string;
          child_id: string;
          eta?: string | null;
          tenant_id: string;
          trip_id: string;
          trip_stop_id: string;
        };
        Update: {
          bus_rider_id?: string;
          child_id?: string;
          eta?: string | null;
          tenant_id?: string;
          trip_id?: string;
          trip_stop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_stop_riders_bus_rider_id_fkey';
            columns: ['bus_rider_id'];
            isOneToOne: false;
            referencedRelation: 'bus_riders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_stop_riders_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_stop_riders_trip_stop_id_fkey';
            columns: ['trip_stop_id'];
            isOneToOne: false;
            referencedRelation: 'trip_stops';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_stops: {
        Row: {
          created_at: string;
          id: string;
          label: string | null;
          lat: number | null;
          lng: number | null;
          reached_at: string | null;
          sequence: number;
          tenant_id: string;
          trip_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label?: string | null;
          lat?: number | null;
          lng?: number | null;
          reached_at?: string | null;
          sequence: number;
          tenant_id: string;
          trip_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string | null;
          lat?: number | null;
          lng?: number | null;
          reached_at?: string | null;
          sequence?: number;
          tenant_id?: string;
          trip_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_stops_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trips: {
        Row: {
          arrived_at: string | null;
          bus_id: string;
          completed_at: string | null;
          created_at: string;
          id: string;
          leg: Database['transport']['Enums']['trip_leg'];
          service_date: string;
          started_at: string | null;
          status: Database['transport']['Enums']['trip_status'];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          arrived_at?: string | null;
          bus_id: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          leg: Database['transport']['Enums']['trip_leg'];
          service_date: string;
          started_at?: string | null;
          status?: Database['transport']['Enums']['trip_status'];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          arrived_at?: string | null;
          bus_id?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          leg?: Database['transport']['Enums']['trip_leg'];
          service_date?: string;
          started_at?: string | null;
          status?: Database['transport']['Enums']['trip_status'];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trips_bus_id_fkey';
            columns: ['bus_id'];
            isOneToOne: false;
            referencedRelation: 'buses';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      run_gps_ping_retention_purge: {
        Args: { p_retention_days?: number };
        Returns: number;
      };
    };
    Enums: {
      trip_child_status_value: 'pending' | 'picked_up' | 'dropped_off' | 'absent';
      trip_leg: 'am' | 'pm';
      trip_status: 'scheduled' | 'moving' | 'arrived' | 'completed' | 'cancelled';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  academic: {
    Enums: {
      concern_category: ['academic', 'behavior', 'social', 'health'],
      concern_priority: ['info', 'attention', 'urgent'],
      concern_status: ['open', 'acknowledged', 'resolved'],
      day_path_source: ['driver', 'teacher', 'reception', 'system'],
      day_path_status: ['at_home', 'in_bus', 'classroom', 'playing', 'nap', 'delivered'],
      gender: ['male', 'female'],
      grade_level: ['pre_kg', 'kg1', 'kg2', 'nursery'],
      guardian_relation: ['father', 'mother', 'guardian'],
      homework_status: ['done', 'partial', 'none'],
      membership_status: ['active', 'overdue', 'suspended'],
      package_type: ['full_day', 'half_day'],
    },
  },
  approvals: {
    Enums: {
      event_type: ['exam', 'celebration', 'trip'],
      exam_kind: ['weekly', 'monthly'],
      request_status: ['pending', 'approved', 'rejected'],
      request_type: ['event', 'trip', 'exam'],
      rsvp_attendee: ['child', 'father', 'mother', 'both'],
      trip_registration_status: ['open', 'registered', 'paid', 'cancelled'],
    },
  },
  billing: {
    Enums: {
      billing_status: ['unbilled', 'due', 'partially_paid', 'paid', 'overdue'],
      fee_cycle: ['monthly', 'per_term', 'once_per_year', 'one_time'],
      fee_scope: ['all', 'optional'],
      invoice_status: ['unpaid', 'paid', 'void'],
      payment_method: ['bank_transfer', 'instapay', 'wallet', 'fawry'],
      payment_status: ['initiated', 'pending_verification', 'succeeded', 'failed', 'refunded'],
    },
  },
  comms: {
    Enums: {
      announcement_audience: ['all', 'parents', 'classroom', 'teachers', 'drivers'],
      announcement_channel: ['push', 'whatsapp', 'sms', 'email', 'in_app'],
      announcement_priority: ['normal', 'important', 'urgent'],
      announcement_recipient_type: ['guardian', 'staff', 'driver', 'tenant'],
      conversation_status: ['open', 'escalated', 'closed'],
      device_platform: ['ios', 'android', 'web'],
      message_sender_type: ['guardian', 'staff', 'system'],
      notification_channel: ['push', 'whatsapp', 'sms', 'email', 'in_app'],
      notification_delivery_status: ['queued', 'sent', 'delivered', 'failed', 'skipped_by_preference'],
      notification_recipient_type: ['guardian', 'staff', 'driver', 'platform_admin'],
      notification_severity: ['info', 'attention', 'urgent'],
      platform_announcement_audience: ['all_schools', 'plan_tier', 'overdue_accounts', 'trial_accounts'],
    },
  },
  identity: {
    Enums: {
      employment_status: ['active', 'on_leave', 'terminated'],
      feedback_kind: ['complaint', 'commend'],
      feedback_severity: ['low', 'medium', 'high'],
      language: ['en', 'ar'],
      platform_admin_tier: ['owner', 'admin', 'support'],
      service_account_purpose: ['camera_agent', 'integration_other'],
      service_account_status: ['active', 'revoked'],
      staff_role: ['manager', 'teacher', 'reception'],
    },
  },
  jobs: {
    Enums: {
      background_job_status: ['queued', 'processing', 'succeeded', 'failed'],
      scheduled_job_run_status: ['running', 'succeeded', 'failed'],
    },
  },
  media: {
    Enums: {
      camera_resolution: ['720p', '1080p', '4k'],
      camera_zone: ['classroom', 'outdoor', 'rest', 'entrance', 'common'],
    },
  },
  platform: {
    Enums: {
      activity_actor_type: ['staff', 'guardian', 'driver', 'system'],
      audit_actor_type: ['platform_admin', 'staff', 'system'],
      billing_transaction_kind: ['subscription_charge', 'setup_fee', 'refund'],
      billing_transaction_status: ['initiated', 'succeeded', 'failed', 'refunded'],
      service_status: ['up', 'degraded', 'down'],
      support_ticket_category: ['technical', 'how_to', 'request', 'billing'],
      support_ticket_severity: ['high', 'med', 'low'],
      support_ticket_status: ['open', 'in_progress', 'resolved'],
    },
  },
  public: {
    Enums: {},
  },
  reports: {
    Enums: {
      delivery_channel: ['app', 'whatsapp', 'email'],
      report_draft_status: ['draft', 'ready', 'scheduled', 'sent'],
      report_scope: ['classroom', 'children'],
      report_type: ['monthly_progress', 'subject_report', 'behavior_social', 'attendance_summary'],
    },
  },
  safety: {
    Enums: {
      pickup_pass_status: ['active', 'expired', 'revoked'],
      pickup_person_relation: [
        'father',
        'mother',
        'uncle',
        'aunt',
        'grandfather',
        'grandmother',
        'sibling',
        'driver',
        'other',
      ],
      pickup_scan_result: ['valid', 'invalid_expired', 'invalid_unknown', 'invalid_revoked'],
    },
  },
  tenancy: {
    Enums: {
      app_code: ['dashboard', 'parent', 'teacher', 'reception', 'driver'],
      phone_account_type: ['staff', 'guardian', 'driver'],
      plan_code: ['starter', 'growth', 'premium'],
      provisioning_step: [
        'created',
        'initial_manager_created',
        'plan_apps_provisioned',
        'welcome_sent',
        'complete',
      ],
      tenant_status: ['trial', 'active', 'overdue', 'suspended'],
    },
  },
  transport: {
    Enums: {
      trip_child_status_value: ['pending', 'picked_up', 'dropped_off', 'absent'],
      trip_leg: ['am', 'pm'],
      trip_status: ['scheduled', 'moving', 'arrived', 'completed', 'cancelled'],
    },
  },
} as const;
