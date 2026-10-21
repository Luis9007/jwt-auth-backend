import { User } from './auth.models';

export interface UserPage {
  items: User[];
  total: number;
  limit: number;
  offset: number;
}

export interface UpdateMeRequest {
  full_name?: string | null;
}

export interface AdminUpdateUserRequest {
  full_name?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
}
