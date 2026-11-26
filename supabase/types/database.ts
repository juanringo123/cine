// ============================================================
// CINÉ — Database types (generated-style, dari migration 0001-0007)
// Dipakai oleh Next.js (@supabase/supabase-js / @supabase/ssr).
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      genres: {
        Row: { id: string; name: string; slug: string; created_at: string };
        Insert: { id?: string; name: string; slug: string; created_at?: string };
        Update: { id?: string; name?: string; slug?: string; created_at?: string };
        Relationships: [];
      };
      movies: {
        Row: {
          id: string;
          tmdb_id: number | null;
          slug: string;
          title: string;
          synopsis: string | null;
          duration_minutes: number;
          release_date: string | null;
          age_rating: Enums<"movie_age_rating"> | null;
          country: string | null;
          director: string | null;
          status: Enums<"movie_status">;
          poster_url: string | null;
          backdrop_url: string | null;
          trailer_url: string | null;
          rating: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tmdb_id?: number | null;
          slug: string;
          title: string;
          synopsis?: string | null;
          duration_minutes: number;
          release_date?: string | null;
          age_rating?: Enums<"movie_age_rating"> | null;
          country?: string | null;
          director?: string | null;
          status?: Enums<"movie_status">;
          poster_url?: string | null;
          backdrop_url?: string | null;
          trailer_url?: string | null;
          rating?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tmdb_id?: number | null;
          slug?: string;
          title?: string;
          synopsis?: string | null;
          duration_minutes?: number;
          release_date?: string | null;
          age_rating?: Enums<"movie_age_rating"> | null;
          country?: string | null;
          director?: string | null;
          status?: Enums<"movie_status">;
          poster_url?: string | null;
          backdrop_url?: string | null;
          trailer_url?: string | null;
          rating?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      movie_genres: {
        Row: { movie_id: string; genre_id: string };
        Insert: { movie_id: string; genre_id: string };
        Update: { movie_id?: string; genre_id?: string };
        Relationships: [];
      };
      movie_cast: {
        Row: {
          id: string;
          movie_id: string;
          name: string;
          character_name: string | null;
          photo_url: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          movie_id: string;
          name: string;
          character_name?: string | null;
          photo_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          movie_id?: string;
          name?: string;
          character_name?: string | null;
          photo_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      cinemas: {
        Row: {
          id: string;
          name: string;
          slug: string;
          city: string;
          address: string | null;
          phone: string | null;
          latitude: number | null;
          longitude: number | null;
          image_url: string | null;
          facilities: string[];
          operating_hours: Json | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          city: string;
          address?: string | null;
          phone?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          image_url?: string | null;
          facilities?: string[];
          operating_hours?: Json | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          city?: string;
          address?: string | null;
          phone?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          image_url?: string | null;
          facilities?: string[];
          operating_hours?: Json | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      studios: {
        Row: {
          id: string;
          cinema_id: string;
          name: string;
          screen_type: Enums<"screen_type">;
          total_rows: number;
          total_seats: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cinema_id: string;
          name: string;
          screen_type?: Enums<"screen_type">;
          total_rows?: number;
          total_seats?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cinema_id?: string;
          name?: string;
          screen_type?: Enums<"screen_type">;
          total_rows?: number;
          total_seats?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      seats: {
        Row: {
          id: string;
          studio_id: string;
          row_label: string;
          seat_number: number;
          seat_type: Enums<"seat_type">;
          x_position: number | null;
          y_position: number | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          row_label: string;
          seat_number: number;
          seat_type?: Enums<"seat_type">;
          x_position?: number | null;
          y_position?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          row_label?: string;
          seat_number?: number;
          seat_type?: Enums<"seat_type">;
          x_position?: number | null;
          y_position?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      showtimes: {
        Row: {
          id: string;
          movie_id: string;
          studio_id: string;
          show_date: string;
          start_time: string;
          end_time: string;
          price: number;
          format: Enums<"showtime_format">;
          language: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          movie_id: string;
          studio_id: string;
          show_date: string;
          start_time: string;
          end_time: string;
          price: number;
          format?: Enums<"showtime_format">;
          language?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          movie_id?: string;
          studio_id?: string;
          show_date?: string;
          start_time?: string;
          end_time?: string;
          price?: number;
          format?: Enums<"showtime_format">;
          language?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          nickname: string | null;
          email: string | null;
          phone: string | null;
          birth_date: string | null;
          city: string | null;
          preferred_cinema_id: string | null;
          avatar_url: string | null;
          role: Enums<"user_role">;
          gender: Enums<"gender"> | null;
          terms_accepted_at: string | null;
          terms_version: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          nickname?: string | null;
          email?: string | null;
          phone?: string | null;
          birth_date?: string | null;
          city?: string | null;
          preferred_cinema_id?: string | null;
          avatar_url?: string | null;
          role?: Enums<"user_role">;
          gender?: Enums<"gender"> | null;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          nickname?: string | null;
          email?: string | null;
          phone?: string | null;
          birth_date?: string | null;
          city?: string | null;
          preferred_cinema_id?: string | null;
          avatar_url?: string | null;
          role?: Enums<"user_role">;
          gender?: Enums<"gender"> | null;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      promos: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          discount_type: Enums<"promo_discount_type">;
          discount_value: number;
          min_purchase: number;
          max_discount: number | null;
          valid_from: string;
          valid_until: string;
          quota: number | null;
          used_count: number;
          per_user_limit: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          description?: string | null;
          discount_type: Enums<"promo_discount_type">;
          discount_value: number;
          min_purchase?: number;
          max_discount?: number | null;
          valid_from?: string;
          valid_until: string;
          quota?: number | null;
          used_count?: number;
          per_user_limit?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          description?: string | null;
          discount_type?: Enums<"promo_discount_type">;
          discount_value?: number;
          min_purchase?: number;
          max_discount?: number | null;
          valid_from?: string;
          valid_until?: string;
          quota?: number | null;
          used_count?: number;
          per_user_limit?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          booking_code: string;
          user_id: string;
          showtime_id: string;
          status: Enums<"booking_status">;
          subtotal: number;
          service_fee: number;
          discount: number;
          total: number;
          promo_id: string | null;
          qr_token: string;
          expires_at: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_code: string;
          user_id: string;
          showtime_id: string;
          status?: Enums<"booking_status">;
          subtotal?: number;
          service_fee?: number;
          discount?: number;
          total?: number;
          promo_id?: string | null;
          qr_token?: string;
          expires_at?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_code?: string;
          user_id?: string;
          showtime_id?: string;
          status?: Enums<"booking_status">;
          subtotal?: number;
          service_fee?: number;
          discount?: number;
          total?: number;
          promo_id?: string | null;
          qr_token?: string;
          expires_at?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      showtime_seats: {
        Row: {
          id: string;
          showtime_id: string;
          seat_id: string;
          status: Enums<"showtime_seat_status">;
          booking_id: string | null;
          held_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          showtime_id: string;
          seat_id: string;
          status?: Enums<"showtime_seat_status">;
          booking_id?: string | null;
          held_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          showtime_id?: string;
          seat_id?: string;
          status?: Enums<"showtime_seat_status">;
          booking_id?: string | null;
          held_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      booking_seats: {
        Row: {
          id: string;
          booking_id: string;
          showtime_seat_id: string;
          seat_label_snapshot: string;
          price_snapshot: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          showtime_seat_id: string;
          seat_label_snapshot: string;
          price_snapshot: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          showtime_seat_id?: string;
          seat_label_snapshot?: string;
          price_snapshot?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      fnb_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fnb_items: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          base_price: number;
          is_combo: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          base_price: number;
          is_combo?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          base_price?: number;
          is_combo?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fnb_variants: {
        Row: {
          id: string;
          item_id: string;
          name: string;
          price: number;
          sku: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          name: string;
          price: number;
          sku?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          name?: string;
          price?: number;
          sku?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fnb_orders: {
        Row: {
          id: string;
          order_code: string;
          user_id: string;
          booking_id: string | null;
          cinema_id: string;
          pickup_date: string;
          pickup_time: string;
          status: Enums<"fnb_order_status">;
          subtotal: number;
          service_fee: number;
          discount: number;
          total: number;
          promo_id: string | null;
          qr_token: string;
          expires_at: string | null;
          paid_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_code: string;
          user_id: string;
          booking_id?: string | null;
          cinema_id: string;
          pickup_date: string;
          pickup_time: string;
          status?: Enums<"fnb_order_status">;
          subtotal?: number;
          service_fee?: number;
          discount?: number;
          total?: number;
          promo_id?: string | null;
          qr_token?: string;
          expires_at?: string | null;
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_code?: string;
          user_id?: string;
          booking_id?: string | null;
          cinema_id?: string;
          pickup_date?: string;
          pickup_time?: string;
          status?: Enums<"fnb_order_status">;
          subtotal?: number;
          service_fee?: number;
          discount?: number;
          total?: number;
          promo_id?: string | null;
          qr_token?: string;
          expires_at?: string | null;
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fnb_order_items: {
        Row: {
          id: string;
          order_id: string;
          item_id: string;
          variant_id: string | null;
          item_name_snapshot: string;
          variant_name_snapshot: string | null;
          unit_price: number;
          quantity: number;
          notes: string | null;
          line_total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          item_id: string;
          variant_id?: string | null;
          item_name_snapshot: string;
          variant_name_snapshot?: string | null;
          unit_price: number;
          quantity: number;
          notes?: string | null;
          line_total: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          item_id?: string;
          variant_id?: string | null;
          item_name_snapshot?: string;
          variant_name_snapshot?: string | null;
          unit_price?: number;
          quantity?: number;
          notes?: string | null;
          line_total?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          booking_id: string | null;
          fnb_order_id: string | null;
          method: Enums<"payment_method">;
          provider: string | null;
          amount: number;
          status: Enums<"payment_status">;
          va_number: string | null;
          payment_url: string | null;
          external_id: string | null;
          paid_at: string | null;
          expires_at: string | null;
          raw_response: Json | null;
          saved_card_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id?: string | null;
          fnb_order_id?: string | null;
          method: Enums<"payment_method">;
          provider?: string | null;
          amount: number;
          status?: Enums<"payment_status">;
          va_number?: string | null;
          payment_url?: string | null;
          external_id?: string | null;
          paid_at?: string | null;
          expires_at?: string | null;
          raw_response?: Json | null;
          saved_card_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string | null;
          fnb_order_id?: string | null;
          method?: Enums<"payment_method">;
          provider?: string | null;
          amount?: number;
          status?: Enums<"payment_status">;
          va_number?: string | null;
          payment_url?: string | null;
          external_id?: string | null;
          paid_at?: string | null;
          expires_at?: string | null;
          raw_response?: Json | null;
          saved_card_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      promo_redemptions: {
        Row: {
          id: string;
          promo_id: string;
          user_id: string;
          booking_id: string | null;
          fnb_order_id: string | null;
          discount_amount: number;
          redeemed_at: string;
        };
        Insert: {
          id?: string;
          promo_id: string;
          user_id: string;
          booking_id?: string | null;
          fnb_order_id?: string | null;
          discount_amount: number;
          redeemed_at?: string;
        };
        Update: {
          id?: string;
          promo_id?: string;
          user_id?: string;
          booking_id?: string | null;
          fnb_order_id?: string | null;
          discount_amount?: number;
          redeemed_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          type: Enums<"notification_type">;
          data: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body: string;
          type?: Enums<"notification_type">;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string;
          type?: Enums<"notification_type">;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      faqs: {
        Row: {
          id: string;
          category: string;
          question: string;
          answer: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category?: string;
          question: string;
          answer: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?: string;
          question?: string;
          answer?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: { key: string; value: Json; updated_at: string };
        Insert: { key: string; value: Json; updated_at?: string };
        Update: { key?: string; value?: Json; updated_at?: string };
        Relationships: [];
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          recipient_name: string;
          phone: string | null;
          address_line: string;
          rt: string | null;
          rw: string | null;
          district: string | null;
          city: string | null;
          province: string | null;
          postal_code: string | null;
          courier_note: string | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string;
          recipient_name: string;
          phone?: string | null;
          address_line: string;
          rt?: string | null;
          rw?: string | null;
          district?: string | null;
          city?: string | null;
          province?: string | null;
          postal_code?: string | null;
          courier_note?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string;
          recipient_name?: string;
          phone?: string | null;
          address_line?: string;
          rt?: string | null;
          rw?: string | null;
          district?: string | null;
          city?: string | null;
          province?: string | null;
          postal_code?: string | null;
          courier_note?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_cards: {
        Row: {
          id: string;
          user_id: string;
          brand: Enums<"card_brand">;
          last4: string;
          expiry_month: number;
          expiry_year: number;
          holder_name: string | null;
          gateway_token: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          brand?: Enums<"card_brand">;
          last4: string;
          expiry_month: number;
          expiry_year: number;
          holder_name?: string | null;
          gateway_token: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          brand?: Enums<"card_brand">;
          last4?: string;
          expiry_month?: number;
          expiry_year?: number;
          holder_name?: string | null;
          gateway_token?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      whatsapp_otps: {
        Row: {
          id: string;
          phone: string;
          user_id: string;
          code_hash: string;
          expires_at: string;
          attempts: number;
          consumed_at: string | null;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          phone: string;
          user_id: string;
          code_hash: string;
          expires_at: string;
          attempts?: number;
          consumed_at?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          phone?: string;
          user_id?: string;
          code_hash?: string;
          expires_at?: string;
          attempts?: number;
          consumed_at?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_my_bookings: {
        Row: {
          id: string;
          kind: string;
          code: string;
          user_id: string;
          status: string;
          status_group: string;
          schedule_date: string;
          schedule_time: string;
          title: string;
          image_url: string | null;
          venue: string;
          total: number;
          qr_token: string;
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      get_app_setting_numeric: {
        Args: { p_key: string; p_default: number };
        Returns: number;
      };
      generate_booking_code: { Args: Record<string, never>; Returns: string };
      generate_order_code: { Args: Record<string, never>; Returns: string };
      normalize_phone: { Args: { p_phone: string }; Returns: string | null };
      validate_promo: {
        Args: { p_code: string; p_subtotal: number; p_user_id?: string };
        Returns: Json;
      };
      create_booking: {
        Args: { p_showtime_id: string; p_seat_ids: string[]; p_promo_code?: string };
        Returns: Json;
      };
      create_fnb_order: {
        Args: {
          p_items: Json;
          p_cinema_id: string;
          p_pickup_date: string;
          p_pickup_time: string;
          p_booking_id?: string;
          p_promo_code?: string;
          p_notes?: string;
        };
        Returns: Json;
      };
      create_payment: {
        Args: {
          p_booking_id?: string;
          p_fnb_order_id?: string;
          p_method?: Enums<"payment_method">;
          p_provider?: string;
          p_saved_card_id?: string;
        };
        Returns: Json;
      };
      confirm_payment: { Args: { p_payment_id: string }; Returns: Json };
      fail_payment: {
        Args: { p_payment_id: string; p_reason?: string };
        Returns: Json;
      };
      cancel_booking: { Args: { p_booking_id: string }; Returns: Json };
      release_expired_bookings: { Args: Record<string, never>; Returns: Json };
      get_seat_map: {
        Args: { p_showtime_id: string };
        Returns: Array<{
          seat_id: string;
          row_label: string;
          seat_number: number;
          seat_type: Enums<"seat_type">;
          x_position: number | null;
          y_position: number | null;
          status: Enums<"showtime_seat_status">;
          held_until: string | null;
          is_mine: boolean;
        }>;
      };
      find_user_by_phone: { Args: { p_phone: string }; Returns: Json };
      find_payment_by_external_id: {
        Args: { p_external_id: string };
        Returns: Json;
      };
      get_ticket_by_code: { Args: { p_code: string }; Returns: Json };
      get_order_by_code: { Args: { p_code: string }; Returns: Json };
      verify_ticket_qr: {
        Args: { p_code: string; p_token: string };
        Returns: Json;
      };
      generate_studio_seats: {
        Args: {
          p_studio_id: string;
          p_rows: number;
          p_cols: number;
          p_couple_seats?: number;
        };
        Returns: Json;
      };
      admin_mark_paid: { Args: { p_payment_id: string }; Returns: Json };
      create_whatsapp_otp: {
        Args: {
          p_phone: string;
          p_user_id: string;
          p_code_hash: string;
          p_ttl_seconds?: number;
        };
        Returns: Json;
      };
      verify_whatsapp_otp: {
        Args: { p_phone: string; p_code_hash: string };
        Returns: Json;
      };
      apply_promo_to_booking: {
        Args: { p_booking_id: string; p_promo_code: string };
        Returns: Json;
      };
      apply_promo_to_fnb_order: {
        Args: { p_order_id: string; p_promo_code: string };
        Returns: Json;
      };
    };
    Enums: {
      user_role: "customer" | "admin" | "staff";
      movie_status: "now_showing" | "coming_soon" | "archived";
      movie_age_rating: "SU" | "13+" | "17+" | "21+";
      screen_type: "regular_2d" | "3d" | "imax" | "premiere";
      showtime_format: "regular_2d" | "3d" | "imax" | "premiere";
      seat_type: "regular" | "premium" | "couple";
      showtime_seat_status: "available" | "held" | "booked" | "blocked";
      booking_status:
        | "pending_payment"
        | "paid"
        | "confirmed"
        | "canceled"
        | "expired"
        | "completed"
        | "refunded";
      payment_method: "qris" | "gopay" | "ovo" | "bank_transfer" | "card";
      payment_status: "pending" | "paid" | "failed" | "expired" | "refunded";
      promo_discount_type: "fixed" | "percent";
      fnb_order_status:
        | "cart"
        | "pending_payment"
        | "paid"
        | "preparing"
        | "ready"
        | "completed"
        | "canceled";
      notification_type: "booking" | "payment" | "promo" | "fnb" | "system";
      gender: "male" | "female";
      card_brand: "visa" | "mastercard" | "amex" | "other";
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type InsertTables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> =
  PublicSchema["Views"][T]["Row"];
export type Functions<T extends keyof PublicSchema["Functions"]> =
  PublicSchema["Functions"][T];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

// Short aliases yang sering dipakai di UI.
export type Movie = Tables<"movies">;
export type Cinema = Tables<"cinemas">;
export type Showtime = Tables<"showtimes">;
export type Profile = Tables<"profiles">;
export type Booking = Tables<"bookings">;
export type MyBooking = Views<"v_my_bookings">;
export type SeatMapRow = Functions<"get_seat_map">["Returns"][number];
export type FnbVariant = Tables<"fnb_variants">;
export type FnbItem = Tables<"fnb_items">;
export type Studio = Tables<"studios">;
export type Promo = Tables<"promos">;
export type FnbOrder = Tables<"fnb_orders">;
