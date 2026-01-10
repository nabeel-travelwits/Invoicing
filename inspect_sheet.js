import './server/config/env.js';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

async function inspectSheet() {
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

    console.log('Available Sheets:');
    doc.sheetsByIndex.forEach(s => console.log(` - ${s.title}`));

    const testSheet = doc.sheetsByTitle["Test emails"];
    if (testSheet) {
        await testSheet.loadHeaderRow();
        console.log('\n"Test emails" Header Columns:', testSheet.headerValues);
        const rows = await testSheet.getRows();
        console.log(`First 5 rows of test emails:`, rows.slice(0, 5).map(r => r.toObject()));
    } else {
        console.log('\n"Test emails" tab NOT FOUND');
    }

    const rosterSheet = doc.sheetsByTitle["Auth0 Users List"];
    if (rosterSheet) {
        await rosterSheet.loadHeaderRow();
        console.log('\n"Auth0 Users List" Header Columns:', rosterSheet.headerValues);
    }
}

inspectSheet();
