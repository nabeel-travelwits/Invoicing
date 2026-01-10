import './server/config/env.js';
import baserow from './server/services/BaserowService.js';
import sheets from './server/services/GoogleSheetsService.js';
import { reconcileUsers } from './server/utils/ReconciliationEngine.js';

async function debugReconciliation(agencyId) {
    console.log(`\n--- Debugging Reconciliation for Agency ID: ${agencyId} ---`);
    const sheetId = '1-DilrlkKOa9QJDBi87NhVv9LaXnY_dw0fHwjzfqmCyM';
    const billingPeriod = '2026-01';

    try {
        console.log('Fetching Baserow Users...');
        const baserowUsers = await baserow.getAllUsersByAgency(agencyId);
        console.log(`Found ${baserowUsers.length} users in Baserow`);
        if (baserowUsers.length > 0) console.log('First user:', baserowUsers[0]);

        console.log('\nFetching Google Sheet Roster...');
        const sheetUsers = await sheets.getAgencyRoster(sheetId, agencyId);
        console.log(`Found ${sheetUsers.length} users in Sheet`);
        if (sheetUsers.length > 0) console.log('First user:', sheetUsers[0]);

        console.log('\nFetching Test Emails...');
        const testEmails = await sheets.getTestEmails(sheetId);
        console.log(`Found ${testEmails.length} test emails`);
        console.log('Test Emails sample:', testEmails.slice(0, 5));

        console.log('\nRunning Reconciliation Engine...');
        const reconciliation = reconcileUsers(baserowUsers, sheetUsers, billingPeriod, 15.0, testEmails);

        console.log('\n--- Results ---');
        console.log('Summary:', reconciliation.summary);
        console.log('Total Normal:', reconciliation.normal.length);
        console.log('Total Test Users found in data:', reconciliation.testUsers.length);
        console.log('Total Mismatches:', reconciliation.mismatches.length);

        if (reconciliation.mismatches.length > 0) {
            console.log('\nMismatch Sample:', reconciliation.mismatches[0]);
        }

    } catch (error) {
        console.error('Reconciliation Debug Error:', error.message);
    }
}

// Test with Agency 1
debugReconciliation('1');
