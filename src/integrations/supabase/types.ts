export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      employees: {
        Row: {
          active: boolean;
          auth_user_id: string | null;
          created_at: string;
          designation: string | null;
          employee_code: string;
          employee_id: string | null;
          employee_name: string;
          hq: string | null;
          id: string;
          manager_code: string | null;
          manager_id: string | null;
          name: string | null;
          role: string | null;
          state: string | null;
          status: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          active?: boolean;
          auth_user_id?: string | null;
          created_at?: string;
          designation?: string | null;
          employee_code: string;
          employee_id?: string | null;
          employee_name: string;
          hq?: string | null;
          id?: string;
          manager_code?: string | null;
          manager_id?: string | null;
          name?: string | null;
          role?: string | null;
          state?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          active?: boolean;
          auth_user_id?: string | null;
          created_at?: string;
          designation?: string | null;
          employee_code?: string;
          employee_id?: string | null;
          employee_name?: string;
          hq?: string | null;
          id?: string;
          manager_code?: string | null;
          manager_id?: string | null;
          name?: string | null;
          role?: string | null;
          state?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      monthly_sales: {
        Row: {
          created_at: string;
          employee_code: string;
          employee_id: string | null;
          financial_year: string;
          id: string;
          month: number;
          previous_year_sales: number;
          sales_amount: number;
          updated_at: string;
          year: number | null;
        };
        Insert: {
          created_at?: string;
          employee_code: string;
          employee_id?: string | null;
          financial_year: string;
          id?: string;
          month: number;
          previous_year_sales?: number;
          sales_amount?: number;
          updated_at?: string;
          year?: number | null;
        };
        Update: {
          created_at?: string;
          employee_code?: string;
          employee_id?: string | null;
          financial_year?: string;
          id?: string;
          month?: number;
          previous_year_sales?: number;
          sales_amount?: number;
          updated_at?: string;
          year?: number | null;
        };
        Relationships: [];
      };
      monthly_targets: {
        Row: {
          created_at: string;
          employee_code: string;
          employee_id: string | null;
          financial_year: string;
          id: string;
          month: number;
          target_amount: number;
          updated_at: string;
          year: number | null;
        };
        Insert: {
          created_at?: string;
          employee_code: string;
          employee_id?: string | null;
          financial_year: string;
          id?: string;
          month: number;
          target_amount?: number;
          updated_at?: string;
          year?: number | null;
        };
        Update: {
          created_at?: string;
          employee_code?: string;
          employee_id?: string | null;
          financial_year?: string;
          id?: string;
          month?: number;
          target_amount?: number;
          updated_at?: string;
          year?: number | null;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          auth_user_id: string;
          created_at: string;
          employee_code: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id: string;
          created_at?: string;
          employee_code: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string;
          created_at?: string;
          employee_code?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      imports_log: {
        Row: {
          created_at: string;
          duplicate_rows: number;
          employee_code: string | null;
          error_rows: number;
          errors: Json;
          id: string;
          import_type: string;
          inserted_rows: number;
          metadata: Json;
          preview: Json;
          source_file_name: string | null;
          status: string;
          storage_path: string | null;
          total_rows: number;
          updated_at: string;
          uploaded_by: string | null;
          updated_rows: number;
        };
        Insert: {
          created_at?: string;
          duplicate_rows?: number;
          employee_code?: string | null;
          error_rows?: number;
          errors?: Json;
          id?: string;
          import_type: string;
          inserted_rows?: number;
          metadata?: Json;
          preview?: Json;
          source_file_name?: string | null;
          status?: string;
          storage_path?: string | null;
          total_rows?: number;
          updated_at?: string;
          uploaded_by?: string | null;
          updated_rows?: number;
        };
        Update: {
          created_at?: string;
          duplicate_rows?: number;
          employee_code?: string | null;
          error_rows?: number;
          errors?: Json;
          id?: string;
          import_type?: string;
          inserted_rows?: number;
          metadata?: Json;
          preview?: Json;
          source_file_name?: string | null;
          status?: string;
          storage_path?: string | null;
          total_rows?: number;
          updated_at?: string;
          uploaded_by?: string | null;
          updated_rows?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accessible_employee_codes: {
        Args: Record<string, never>;
        Returns: { employee_code: string }[];
      };
      can_access_employee: {
        Args: { _employee_code: string };
        Returns: boolean;
      };
      claim_employee_account: {
        Args: { _employee_code: string; _role?: string };
        Returns: { auth_user_id: string; employee_code: string; role: string }[];
      };
      current_employee_code: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      fiscal_year_from_month: {
        Args: { _month: number; _year: number };
        Returns: string;
      };
      is_global_access: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_managerial_role: {
        Args: { _role: string };
        Returns: boolean;
      };
      lookup_signup_employee: {
        Args: { _employee_code: string };
        Returns: {
          employee_code: string;
          employee_name: string;
          designation: string | null;
          role: string;
          manager_code: string | null;
          hq: string | null;
          state: string | null;
          active: boolean;
          auth_user_id: string | null;
        }[];
      };
      normalize_portal_role: {
        Args: { _role: string };
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
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
