import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function describe() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    };
    try {
        const pool = await mysql.createPool(config);
        const [rows] = await pool.query('DESCRIBE travelAgency');
        console.log(rows.map(r => r.Field));
        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}
describe();
