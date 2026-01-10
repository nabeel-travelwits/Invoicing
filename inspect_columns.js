import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function inspectTable() {
    // Try to get one record to see keys
    const { data, error } = await supabase.from('invoicing_logs').select('*').limit(1);

    if (error) {
        console.error('Fetch Error:', error);
    } else {
        console.log('Columns found in record:', data.length > 0 ? Object.keys(data[0]) : 'No records yet');
    }

    // Attempt a dummy insert with many potential column names to see which ones fail
    const dummy = {
        agency_id: 'test',
        agency_name: 'test',
        amount: 0,
        period: '2025-01',
        invoice_id: 'test',
        invoice_type: 'Host',
        status: 'Sent',
        email_sent: false
    };

    const { error: insertError } = await supabase.from('invoicing_logs').insert([dummy]);
    if (insertError) {
        console.error('Insert Error details:', insertError);
    } else {
        console.log('Insert successful with all columns.');
    }
}

inspectTable();
