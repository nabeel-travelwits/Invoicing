import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.BASEROW_TOKEN;
const tableId = process.env.BASEROW_USERS_TABLE_ID;

async function checkFields() {
    try {
        const url = `https://api.baserow.io/api/database/rows/table/${tableId}/?user_field_names=true&size=1`;
        const res = await axios.get(url, {
            headers: { Authorization: `Token ${token}` }
        });
        console.log('Sample Row Fields:', Object.keys(res.data.results[0]));
    } catch (err) {
        console.error(err.message);
    }
}
checkFields();
