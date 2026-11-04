import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rdhihhudubthlmuzgawx.supabase.co';
const supabaseAnonKey = 'sb_publishable_Kg11ith0x-0qysAsg5NnOA_G3hvzrs7';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);