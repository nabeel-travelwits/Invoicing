import cfpService from './server/services/CFPService.js';
import './server/config/env.js'; // Load env

async function testCFP() {
    console.log('Testing CFP Service...');
    try {
        // Test with a known agency name from the user's request context or a dummy one
        // Browsing previous context, "CFP" or "TravelWits" might not be the agency name in the rows.
        // I will search for ANY booking to verify the service works.

        // Actually CFPService filters by agencyName.
        // Let's first inspect the RAW rows to see what agency names exist.

        // I can't call cfpService.getBookingsForAgency without a name.
        // But I can modify the service or just duplicate the logic here to inspect.

        // Wait, I can use GoogleSheetsService directly to inspect.
        // But let's test the endpoint logic via a script.

        // I'll assume an agency name "Global Marine Travel" or something common, or I'll just check what's there.
        // Better: I'll invoke the method I added to GoogleSheetsService in a standalone way.

        const sheetId = '1hyX_k-XcE5F5WjFIwC49z0-HhHPhu8zN7r1N_DOlwsQ';

        // Dynamic import to avoid path issues if I run node test_cfp.js from root
        const sheetsService = (await import('./server/services/GoogleSheetsService.js')).default;

        const rows = await sheetsService.getRawSheetValues(sheetId);
        console.log(`Fetched ${rows.length} rows.`);

        if (rows.length > 0) {
            console.log('First row headers:', Object.keys(rows[0]));
            // Sample row
            console.log('First row data:', rows[0]);

            // Check unique agencies
            const agencies = [...new Set(rows.map(r => r.AgencyName).filter(Boolean))];
            console.log('Found Agencies:', agencies.slice(0, 10)); // Show top 10

            // Filter logic test
            const blankEmail = rows.filter(r => !r.loggedInUserEmail).length;
            console.log(`Rows with blank loggedInUserEmail: ${blankEmail}`);

            const booked = rows.filter(r => (r.tripStatus || '').toLowerCase() === 'booked').length;
            console.log(`Rows with 'booked' status: ${booked}`);
        } else {
            console.log('No rows returned.');
        }

    } catch (e) {
        console.error('Test Failed:', e);
    }
}

testCFP();
