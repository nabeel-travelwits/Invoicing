import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function testPartialInsert() {
    const dummy = {
        agency_id: 'test_id',
        agency_name: 'test_name',
        amount: 0,
        period: '2025-01',
        invoice_id: 'test_inv',
        invoice_type: 'Host',
        email_sent: false
    };

    const { error } = await supabase.from('invoicing_logs').insert([dummy]);
    if (error) {
        console.error('Insert Error:', error);
    } else {
        console.log('Insert successful! Checking columns of inserted row...');
        const { data } = await supabase.from('invoicing_logs').select('*').eq('agency_id', 'test_id');
        console.log('Row columns:', Object.keys(data[0]));
    }
}

testPartialInsert();
