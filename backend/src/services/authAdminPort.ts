// Narrow port over Supabase's Auth Admin API — lets services depend on an
// interface instead of the full supabase-js client, which is what makes
// tenantProvisioningService.test.ts able to run with a fake implementation
// and no live Supabase project.
import type { AnySupabaseClient } from '../lib/supabaseClient.js';

export interface CreatedAuthUser {
  id: string;
}

export interface AuthAdminPort {
  createUser(input: {
    phone: string;
    appMetadata: Record<string, unknown>;
    userMetadata: Record<string, unknown>;
  }): Promise<CreatedAuthUser>;
  deleteUser(userId: string): Promise<void>;
  signOutGlobal(userId: string): Promise<void>;
}

export class SupabaseAuthAdminPort implements AuthAdminPort {
  constructor(private readonly client: AnySupabaseClient) {}

  async createUser(input: {
    phone: string;
    appMetadata: Record<string, unknown>;
    userMetadata: Record<string, unknown>;
  }): Promise<CreatedAuthUser> {
    const { data, error } = await this.client.auth.admin.createUser({
      phone: input.phone,
      phone_confirm: true,
      app_metadata: input.appMetadata,
      user_metadata: input.userMetadata,
      // No password — activation-link-only account creation (§10.3).
    });
    if (error || !data?.user) {
      throw new Error(`auth.admin.createUser failed: ${error?.message ?? 'unknown error'}`);
    }
    return { id: data.user.id };
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(userId);
    if (error) throw new Error(`auth.admin.deleteUser failed: ${error.message}`);
  }

  async signOutGlobal(userId: string): Promise<void> {
    const { error } = await this.client.auth.admin.signOut(userId, 'global');
    if (error) throw new Error(`auth.admin.signOut failed: ${error.message}`);
  }
}
