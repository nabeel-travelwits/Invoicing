import './server/config/env.js';
import airtable from './server/services/AirtableService.js';

async function checkComplex() {
    const list = await airtable.getFilterList();
    const complex = list.filter(a => a.agreementType === 'Complex');
    console.log('Complex Agencies in Airtable:', complex);
}

checkComplex();
