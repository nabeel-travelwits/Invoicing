import './server/config/env.js';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

async function inspectComplexData() {
    const sheetId = '1-DilrlkKOa9QJDBi87NhVv9LaXnY_dw0fHwjzfqmCyM';
    const privateKey = process.env.GOOGLE_PRIVATE_KEY
        ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '')
        : null;

    const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();

    const targetSheet = doc.sheetsByTitle["Customers Metadata - Airtable"];
    if (targetSheet) {
        await targetSheet.loadHeaderRow();
        console.log('Headers:', targetSheet.headerValues);
        const rows = await targetSheet.getRows();
        console.log('Sample Row:', rows[0]?.toObject());
    } else {
        console.log('Sheet not found');
    }
}

inspectComplexData();
