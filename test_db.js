import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function testConnection() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        waitForConnections: true,
        connectionLimit: 1,
        queueLimit: 0
    };

    console.log('Testing connection to host:', config.host);
    console.log('User:', config.user);

    try {
        const connection = await mysql.createConnection(config);
        console.log('Successfully connected to MySQL server!');

        const [databases] = await connection.query('SHOW DATABASES');
        console.log('Available databases:');
        databases.forEach(db => console.log(' -', db.Database));

        await connection.end();
    } catch (err) {
        console.error('Connection failed:', err.message);
    }
}

testConnection();
