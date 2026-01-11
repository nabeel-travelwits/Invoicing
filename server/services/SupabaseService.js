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
        return (data || []).map(log => {
            const isInvoice = log.invoice_type === 'Host' || log.invoice_type === 'CFP';
            return {
                id: log.id,
                timestamp: log.timestamp,
                agencyId: log.agency_id,
                // Robust agency name: use agency_name column, but only if it's not an email
                agencyName: (log.agency_name && !log.agency_name.includes('@')) ? log.agency_name : (isInvoice ? (log.invoice_id && !log.invoice_id.includes('-') ? log.invoice_id : 'Host Agency') : ''),
                amount: log.amount,
                period: log.period,
                invoiceId: log.invoice_id,
                // Ensure invoiceNumber is never just an empty dash for real invoices
                invoiceNumber: log.invoice_number || (isInvoice ? (log.invoice_id || 'PROCESSED') : ''),
                invoiceType: log.invoice_type,
                emailSent: log.email_sent,
                status: log.status || (isInvoice ? 'Sent' : 'Action'),
                details: (log.invoice_id && log.invoice_id !== log.status) ? log.invoice_id : '',
                loggedInUser: log.logged_in_user || (log.agency_name && log.agency_name.includes('@') ? log.agency_name : 'System')
            };
        });
    },

    async saveLog(logEntry) {
        const isInvoice = logEntry.invoiceType === 'Host' || logEntry.invoiceType === 'CFP';

        // Try saving with the full NEW schema first
        const fullLog = {
            timestamp: logEntry.timestamp || new Date().toISOString(),
            agency_id: logEntry.agencyId?.toString() || '0',
            agency_name: logEntry.agencyName || 'System',
            amount: parseFloat(logEntry.amount || 0),
            period: logEntry.period || new Date().toISOString().slice(0, 7),
            invoice_id: logEntry.details || logEntry.invoiceId || 'Action',
            invoice_type: logEntry.invoiceType || 'System',
            email_sent: Boolean(logEntry.emailSent),
            status: logEntry.status || logEntry.action || 'Action',
            logged_in_user: logEntry.loggedInUser || 'System',
            invoice_number: logEntry.invoiceNumber || (isInvoice ? logEntry.invoiceId : '')
        };

        try {
            const { data, error } = await supabase
                .from('invoicing_logs')
                .insert([fullLog])
                .select();

            if (!error) {
                console.log('SUPABASE SUCCESS (New Schema):', data?.[0]?.id);
                return data;
            }

            // If error isn't about missing columns, throw it
            if (!error.message.includes('Could not find') && !error.message.includes('column')) {
                throw error;
            }

            console.warn('Supabase new schema columns missing, falling back to legacy mapping...');
        } catch (e) {
            console.warn('Supabase new schema insert failed, trying fallback...', e.message);
        }

        // FALLBACK: Use only columns guaranteed to exist in the original schema
        const fallbackLog = {
            timestamp: logEntry.timestamp || new Date().toISOString(),
            agency_id: logEntry.agencyId?.toString() || '0',
            agency_name: isInvoice ? (logEntry.agencyName || 'System') : (logEntry.loggedInUser || 'System'),
            amount: parseFloat(logEntry.amount || 0),
            period: logEntry.period || new Date().toISOString().slice(0, 7),
            invoice_id: logEntry.invoiceId || logEntry.status || 'Action',
            invoice_type: logEntry.invoiceType || 'System',
            email_sent: Boolean(logEntry.emailSent)
        };

        const { data, error: fbError } = await supabase
            .from('invoicing_logs')
            .insert([fallbackLog])
            .select();

        if (fbError) {
            console.error('Supabase Fallback Insert Error:', fbError.message);
            throw fbError;
        }
        console.log('SUPABASE SUCCESS (Fallback Schema):', data?.[0]?.id);
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
    },

    // --- Agency Stages ---
    async getAgencyStages() {
        const resetDate = new Date();
        resetDate.setDate(resetDate.getDate() - 29);

        try {
            const { data, error } = await supabase
                .from('agency_stages')
                .select('*')
                .gt('updated_at', resetDate.toISOString());

            if (error) {
                // Return empty if table doesn't exist yet
                if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('not found')) {
                    console.warn('Agency stages table not found, skipping...');
                    return [];
                }
                throw error;
            }
            return data || [];
        } catch (e) {
            console.warn('Silent failure fetching stages:', e.message);
            return [];
        }
    },

    async updateAgencyStage(agencyId, stage, updatedBy) {
        const { data, error } = await supabase
            .from('agency_stages')
            .upsert({
                agency_id: agencyId.toString(),
                stage,
                updated_at: new Date(),
                updated_by: updatedBy
            }, { onConflict: 'agency_id' });

        if (error) throw error;
        return data;
    }
};
