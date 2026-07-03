import { USE_SUPABASE } from '@/lib/config';
import type { Store } from './types';
import { demoStore } from './demo';
import { supabaseStore } from './supabase';

// Seleciona a implementação conforme o ambiente.
export const store: Store = USE_SUPABASE ? supabaseStore : demoStore;
export type { Store } from './types';
