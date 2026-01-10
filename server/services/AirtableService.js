import Airtable from 'airtable';

class AirtableService {
    constructor() {
        if (!process.env.AIRTABLE_TOKEN) {
            console.warn('Airtable Token missing in .env');
            return;
        }
        this.base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
        this.tableName = process.env.AIRTABLE_TABLE_NAME || 'Invoices';
    }

    async getAgencyPricing(agencyId) {
        try {
            // Updated to use confirmed Airtable Field Name 'ID'
            const records = await this.base(this.tableName).select({
                filterByFormula: `{ID} = '${agencyId}'`,
                maxRecords: 1
            }).firstPage();

            if (!records || records.length === 0) {
                console.warn(`No Airtable record found for Agency ID: ${agencyId}`);
                return null;
            }

            const fields = records[0].fields;
            console.log(`Found Airtable configuration for ${fields['Name'] || agencyId}`);

            return {
                id: String(fields['ID'] || agencyId),
                name: fields['Name'],
                status: fields['Status'],
                email: fields['Email'] ? String(fields['Email']).trim() : null, // Added Email field and trim
                // Mapping confirmed Title Case field names from Airtable
                userCharge: parseFloat(fields['User Charge'] || 0),
                segmentCharge: parseFloat(fields['Segment Charge'] || 0),
                agreementType: fields['User Agreement Type'] || 'Simple'
            };
        } catch (error) {
            console.error('Airtable Error:', error.message);
            throw new Error(`Failed to fetch pricing from Airtable: ${error.message}`);
        }
    }

    async getFilterList() {
        try {
            // Fetch all records from the Invoices table
            const records = await this.base(this.tableName).select({
                fields: ['ID', 'Name', 'User Charge', 'Segment Charge', 'Status', 'User Agreement Type', 'Email']
            }).all();

            return records.map(r => ({
                id: String(r.fields['ID']),
                name: r.fields['Name'],
                email: r.fields['Email'] ? String(r.fields['Email']).trim() : null, // Added Email field and trim
                userPrice: parseFloat(r.fields['User Charge'] || 0),
                segmentPrice: parseFloat(r.fields['Segment Charge'] || 0),
                status: r.fields['Status'],
                agreementType: r.fields['User Agreement Type'] || 'Simple'
            })).filter(a => a.id && a.name);
        } catch (err) {
            console.warn('Failed to fetch Airtable filter list:', err.message);
            return [];
        }
    }
}

export default new AirtableService();
