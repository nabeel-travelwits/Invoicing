import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function testTables() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: 'users',
        waitForConnections: true,
        connectionLimit: 1,
        queueLimit: 0
    };

    try {
        const connection = await mysql.createConnection(config);
        console.log('Connected to database "users"');

        const [tables] = await connection.query('SHOW TABLES');
        console.log('Available tables in "users":');
        tables.forEach(t => console.log(' -', Object.values(t)[0]));

        // Let's check the columns of travelAgency if it exists
        const [columns] = await connection.query('DESCRIBE travelAgency');
        console.log('\nColumns in "travelAgency":');
        columns.forEach(c => console.log(` - ${c.Field} (${c.Type})`));

        await connection.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testTables();
