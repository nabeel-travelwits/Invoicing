import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function testConfirmations() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: 'tw_confirmations',
        waitForConnections: true,
        connectionLimit: 1,
        queueLimit: 0
    };

    try {
        const connection = await mysql.createConnection(config);
        console.log('Connected to database "tw_confirmations"');

        const [tables] = await connection.query('SHOW TABLES');
        console.log('Available tables:');
        tables.forEach(t => console.log(' -', Object.values(t)[0]));

        await connection.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testConfirmations();
