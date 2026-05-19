'use server';

import { createClient } from '@supabase/supabase-js';
import { UserType } from '@/contexts/AuthContext';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvYmZwbGl0cnpnZ2d6cXN5Y2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxNjg1OCwiZXhwIjoyMDgzODkyODU4fQ.MLZa1crIU7Uid70GFsRPPkoWZ1TgzDDSej99eYD3ctg';

// Cliente com service role para operações de admin
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function createUserAction(formData: {
  name: string;
  email: string;
  password: string;
  user_type: UserType;
}) {
  try {
    // 1. Criar usuário no Auth do Supabase (já confirmado)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: formData.email,
      password: formData.password,
      email_confirm: true,
      user_metadata: { name: formData.name }
    });

    if (authError) {
      return { error: authError.message };
    }

    if (!authData.user) {
      return { error: 'Falha ao criar usuário no sistema de autenticação.' };
    }

    // 2. Criar perfil na tabela 'users'
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        name: formData.name,
        email: formData.email,
        user_type: formData.user_type
      });

    if (profileError) {
      // Se falhar ao criar o perfil, idealmente deveríamos deletar o usuário do auth
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return { error: profileError.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error in createUserAction:', err);
    return { error: 'Erro interno ao criar usuário.' };
  }
}

export async function updateUserAction(payload: {
  id: string;
  name?: string;
  user_type?: UserType;
  password?: string;
}) {
  try {
    const { id, name, user_type, password } = payload;
    if (!id) return { error: 'id é obrigatório' };

    // Update auth password and metadata if provided
    if (password || name) {
      const authUpdate: { password?: string; user_metadata?: Record<string, unknown> } = {};
      if (password) authUpdate.password = password;
      if (name) authUpdate.user_metadata = { name };

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdate);
      if (authError) {
        return { error: authError.message };
      }
    }

    // Update profile row
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (user_type !== undefined) updates.user_type = user_type;

    if (Object.keys(updates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .update(updates)
        .eq('id', id);

      if (profileError) {
        return { error: profileError.message };
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Error in updateUserAction:', err);
    return { error: 'Erro interno ao atualizar usuário.' };
  }
}

export async function deleteUserAction(userId: string) {
  try {
    // 1. Deletar do Auth (isso deve disparar delete na tabela users se houver FK com cascade, 
    // ou fazemos manualmente se não houver)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      return { error: authError.message };
    }

    // 2. Deletar da tabela users (caso não tenha cascade)
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (profileError) {
      return { error: profileError.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error in deleteUserAction:', err);
    return { error: 'Erro interno ao deletar usuário.' };
  }
}

export async function ensureProfileAction(payload: {
  id: string;
  email: string;
  name: string;
}) {
  try {
    // 1. Verificar se já existe por email
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', payload.email)
      .maybeSingle();

    if (existing) {
      return { success: true, alreadyExists: true, profile: existing };
    }

    // 2. Tentar inserir com id
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: payload.id,
        email: payload.email,
        name: payload.name,
        user_type: 'normal',
      });

    // Se a coluna id não existir (42703), tentar sem id
    if (insertError?.code === '42703') {
      const { error: insertWithoutIdError } = await supabaseAdmin
        .from('users')
        .insert({
          email: payload.email,
          name: payload.name,
          user_type: 'normal',
        });

      if (insertWithoutIdError) {
        return { error: insertWithoutIdError.message, code: insertWithoutIdError.code };
      }
    } else if (insertError) {
      return { error: insertError.message, code: insertError.code };
    }

    // 3. Buscar o perfil recém-criado
    const { data: createdProfile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', payload.email)
      .maybeSingle();

    return { success: true, profile: createdProfile };
  } catch (err) {
    console.error('Error in ensureProfileAction:', err);
    return { error: 'Erro interno ao garantir perfil.' };
  }
}
