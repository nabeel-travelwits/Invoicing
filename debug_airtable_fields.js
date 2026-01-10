import './server/config/env.js';
import airtable from './server/services/AirtableService.js';

async function debugAirtableFields() {
    const list = await airtable.base('Invoices').select({ maxRecords: 5 }).firstPage();
    list.forEach(r => {
        console.log(`Record: ${r.fields.Name}`);
        console.log('Fields:', Object.keys(r.fields));
    });
}

debugAirtableFields();
