export interface AuditLog {
  id: number;
  user_id?: string | null;
  event: string;
  success: boolean;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface AuditLogPage {
  items: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}
