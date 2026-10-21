export interface Permission {
  id: number;
  code: string;
  description?: string | null;
}

export interface Role {
  id: number;
  name: string;
  description?: string | null;
  permissions: Permission[];
}

export interface CreateRoleRequest {
  name: string;
  description?: string | null;
}

export interface SetRolePermissionsRequest {
  permission_codes: string[];
}
