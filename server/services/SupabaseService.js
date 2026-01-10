import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials missing in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export default {
    // --- Logs ---
    async getLogs() {
        const { data, error } = await supabase
            .from('invoicing_logs')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;

        // Map back to camelCase for frontend compatibility
        return (data || []).map(log => ({
            id: log.id,
            timestamp: log.timestamp,
            agencyId: log.agency_id,
            agencyName: log.agency_name,
            amount: log.amount,
            period: log.period,
            invoiceId: log.invoice_id,
            invoiceType: log.invoice_type,
            emailSent: log.email_sent
        }));
    },

    async saveLog(logEntry) {
        // Map camelCase keys to snake_case for Supabase columns
        // Note: 'status' column does not exist in the current schema, removing it.
        const mappedLog = {
            timestamp: logEntry.timestamp || new Date().toISOString(),
            agency_id: logEntry.agencyId?.toString(),
            agency_name: logEntry.agencyName,
            amount: parseFloat(logEntry.amount || 0),
            period: logEntry.period,
            invoice_id: logEntry.invoiceId,
            invoice_type: logEntry.invoiceType || 'Host',
            email_sent: Boolean(logEntry.emailSent)
        };

        const { data, error } = await supabase
            .from('invoicing_logs')
            .insert([mappedLog]);

        if (error) throw error;
        return data;
    },

    // --- Configs ---
    async getAgencyConfig(agencyId) {
        const { data, error } = await supabase
            .from('agency_configs')
            .select('config')
            .eq('agency_id', agencyId.toString())
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is 'not found'
        return data?.config || null;
    },

    async saveAgencyConfig(agencyId, config) {
        const { data, error } = await supabase
            .from('agency_configs')
            .upsert({
                agency_id: agencyId.toString(),
                config,
                updated_at: new Date()
            }, { onConflict: 'agency_id' });

        if (error) throw error;
        return data;
    },

    // --- Auth ---
    async getUserByEmail(email) {
        const { data, error } = await supabase
            .from('auth_users')
            .select('*')
            .eq('email', email)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }
};
