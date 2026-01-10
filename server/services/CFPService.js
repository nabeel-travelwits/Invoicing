import sheets from './GoogleSheetsService.js';
import airtable from './AirtableService.js';

class CFPService {
    async getBookingsForAgency(agencyName) {
        // The Sheet ID provided by the user
        const SHEET_ID = '1hyX_k-XcE5F5WjFIwC49z0-HhHPhu8zN7r1N_DOlwsQ';

        try {


            const allRows = await sheets.getRawSheetValues(SHEET_ID);


            const agencyBookings = allRows.filter(row => {
                const userEmail = row['loggedInUserEmail'] || '';
                const status = row['tripStatus'] || '';
                const rowAgencyName = row['AgencyName'] || '';

                if (userEmail.trim() !== '') return false;
                // Removed status check
                // if (status.toLowerCase() !== 'booked') return false;

                // Ensure the row actually has a Trip ID or Booking ID
                if (!row.id && !row.TripID && !row.BookingID && !row['Trip ID']) return false;

                // Fuzzy match agency name? Or exact?
                return rowAgencyName.trim() === agencyName.trim();
            });

            return agencyBookings;

        } catch (error) {
            console.error('CFP Service Error:', error.message);
            // Fallback for demo/dev if no access
            return [];
        }
    }
    async getAllBookingsGrouped() {
        const SHEET_ID = '1hyX_k-XcE5F5WjFIwC49z0-HhHPhu8zN7r1N_DOlwsQ';
        try {
            const allRows = await sheets.getRawSheetValues(SHEET_ID);
            const grouped = {};

            allRows.forEach(row => {
                const userEmail = row['loggedInUserEmail'] || '';
                const status = row['tripStatus'] || '';
                const rowAgencyName = (row['AgencyName'] || '').trim();

                if (userEmail.trim() !== '') return;
                // Removed status check
                // if (status.toLowerCase() !== 'booked') return;
                if (!row.id && !row.TripID && !row.BookingID && !row['Trip ID']) return;
                if (!rowAgencyName) return;

                if (!grouped[rowAgencyName]) {
                    grouped[rowAgencyName] = [];
                }
                grouped[rowAgencyName].push(row);
            });

            return grouped;
        } catch (error) {
            console.error('CFP Batch Service Error:', error.message);
            return {};
        }
    }
}

export default new CFPService();
