import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import './server/config/env.js';

async function scanForColumns(sheetId) {
    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();

    const targetColumns = ['id', 'tripId', 'loggedInUserEmail', 'tripStatus', 'AgencyName'];

    console.log(`Scanning ${doc.sheetCount} sheets for columns: ${targetColumns.join(', ')}`);

    for (let i = 0; i < doc.sheetCount; i++) {
        const sheet = doc.sheetsByIndex[i];
        try {
            await sheet.loadHeaderRow();
            const headers = sheet.headerValues;

            const matchCount = targetColumns.filter(c => headers.includes(c)).length;
            if (matchCount >= 3) {
                console.log(`\n✅ MATCH FOUND: Sheet "${sheet.title}"`);
                console.log(`Columns found: ${headers.join(', ')}`);
                return;
            }
        } catch (e) {
            // ignore empty sheets
        }
    }
    console.log('No matching sheet found.');
}

const sheetId = process.argv[2];
if (sheetId) scanForColumns(sheetId);
