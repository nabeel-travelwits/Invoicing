import mysql from 'mysql2/promise';

class DatabaseService {
    constructor() {
        this.config = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };
        this.pool = mysql.createPool(this.config);
    }

    async getAgencies() {
        try {
            const [rows] = await this.pool.query('SELECT id, name, advisorEmail, contactUsEmail FROM travelAgency');

            return rows.map(r => ({
                id: String(r.id),
                name: r.name || 'Unknown Agency',
                email: r.advisorEmail || r.contactUsEmail || 'billing@travelwits.com',
                userPrice: 15.0,
                segmentPrice: 0.05,
                status: 'Active',
                sheetId: process.env.ROSTER_SHEET_ID
            }));
        } catch (error) {
            console.error('Database Error:', error.message);
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }

    async getAgencyById(id) {
        try {
            const [rows] = await this.pool.query('SELECT id, name, advisorEmail, contactUsEmail FROM travelAgency WHERE id = ?', [id]);
            if (rows.length === 0) return null;

            const r = rows[0];
            return {
                id: String(r.id),
                name: r.name || 'Unknown Agency',
                email: r.advisorEmail || r.contactUsEmail || 'billing@travelwits.com',
                userPrice: 15.0,
                segmentPrice: 0.05,
                status: 'Active',
                sheetId: process.env.ROSTER_SHEET_ID
            };
        } catch (error) {
            console.error('Database Error:', error.message);
            throw new Error(`Database query failed: ${error.message}`);
        }
    }
}

export default new DatabaseService();
