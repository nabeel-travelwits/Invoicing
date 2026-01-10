import './server/config/env.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkConfigs() {
    const { data, error } = await supabase.from('agency_configs').select('*');
    if (error) {
        console.error(error);
    } else {
        console.log('Agency Configs in Supabase:', JSON.stringify(data, null, 2));
    }
}

checkConfigs();
