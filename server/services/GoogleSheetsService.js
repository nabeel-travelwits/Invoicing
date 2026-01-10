import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

class GoogleSheetsService {
    auth = null;
    docCache = new Map();

    async init() {
        if (this.auth) {
            return;
        }

        const privateKey = process.env.GOOGLE_PRIVATE_KEY
            ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '')
            : null;

        this.auth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Use broader scope for potential writes
        });
    }

    async getDoc(spreadsheetId) {
        if (this.docCache.has(spreadsheetId)) {
            return this.docCache.get(spreadsheetId);
        }
        await this.init();
        const doc = new GoogleSpreadsheet(spreadsheetId, this.auth);
        await doc.loadInfo();
        this.docCache.set(spreadsheetId, doc);

        // Clear cache after 5 minutes
        setTimeout(() => this.docCache.delete(spreadsheetId), 5 * 60 * 1000);

        return doc;
    }

    async getRawSheetValues(sheetId) {
        try {
            const doc = await this.getDoc(sheetId);
            const sheet = doc.sheetsByIndex[0]; // Assume first tab
            const rows = await sheet.getRows();
            return rows.map(r => r.toObject());
        } catch (e) {
            console.error('Google Sheets Read Error:', e.message);
            return [];
        }
    }

    async getAgencyRoster(spreadsheetId, agencyId) {
        try {
            const doc = await this.getDoc(spreadsheetId);

            const sheet = doc.sheetsByTitle["Auth0 Users List"];
            if (!sheet) {
                throw new Error('Tab "Auth0 Users List" not found in the spreadsheet.');
            }

            const rows = await sheet.getRows();

            return rows
                .filter(row => {
                    if (agencyId === '_ALL_') return true;

                    const primaryId = String(row.get('Travel Agency ID') || '');
                    const secondaryIds = String(row.get('Travel Agency IDs') || '');

                    const secondaryIdList = secondaryIds.split(',').map(id => id.trim());

                    return primaryId === String(agencyId) || secondaryIdList.includes(String(agencyId));
                })
                .map(row => ({
                    userId: row.get('Registraiton Code') || row.get('Email'),
                    email: row.get('Email'),
                    agencyId: row.get('Travel Agency ID'),
                    secondaryAgencyIds: row.get('Travel Agency IDs'),
                    name: row.get('Name'),
                    activationDate: row.get('SignedUp'),
                    status: row.get('User Status Blocked(True)/Active(False)') === 'TRUE' ? 'Blocked' : 'Active',
                    isCFP: Boolean(row.get('Travel Agency IDs'))
                }));
        } catch (error) {
            console.error('Google Sheets Error:', error.message);
            throw error;
        }
    }

    async getTestEmails(spreadsheetId) {
        try {
            const doc = await this.getDoc(spreadsheetId);

            const sheet = doc.sheetsByTitle["Test emails"];
            if (!sheet) {
                console.warn('Tab "Test emails" not found.');
                return [];
            }

            const rows = await sheet.getRows();
            // Using "Test Emails" column name found in inspection
            return rows.map(row => row.get('Test Emails')?.toLowerCase().trim()).filter(Boolean);
        } catch (error) {
            console.error('Google Sheets Test Emails Error:', error.message);
            return [];
        }
    }
}

export default new GoogleSheetsService();
