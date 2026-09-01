import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bjksuldyyrwxddbvvfrl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dmHMX3U2xmMLlVn5kE4OAQ_8G_g0xNG';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
