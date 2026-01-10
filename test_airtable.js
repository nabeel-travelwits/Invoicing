import './server/config/env.js';
import airtable from './server/services/AirtableService.js';

async function testAirtable() {
    console.log('Testing Airtable connection with new field mapping...');

    // Testing specific agencies
    const testIds = ['1', '72', '5'];

    for (const agencyId of testIds) {
        console.log(`\nFetching data for Agency ID: ${agencyId}`);
        try {
            const config = await airtable.getAgencyPricing(agencyId);
            if (config) {
                console.log('SUCCESS:', JSON.stringify(config, null, 2));
            } else {
                console.log('No record found for ID:', agencyId);
            }
        } catch (err) {
            console.error('ERROR:', err.message);
        }
    }
}

testAirtable();
