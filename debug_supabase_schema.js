import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkSchema() {
    const { data, error } = await supabase
        .from('invoicing_logs')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching logs:', error);
    } else {
        console.log('Sample Log Data:', data);
        if (data && data.length > 0) {
            console.log('Columns:', Object.keys(data[0]));
        } else {
            // Try to find columns via rpc or just check the error if we try to insert dummy
            console.log('No data found to check columns. Trying an empty select to see error details.');
            const { error: error2 } = await supabase.from('invoicing_logs').insert([{ id: 999999 }]);
            console.log('Insert Error (might reveal columns):', error2);
        }
    }
}

checkSchema();
