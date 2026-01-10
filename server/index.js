import './config/env.js';
import express from 'express';
import cors from 'cors';
import asyncHandler from 'express-async-handler';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Services
import baserow from './services/BaserowService.js';
import sheets from './services/GoogleSheetsService.js';
import stripe from './services/StripeService.js';
import swagger from './services/SwaggerService.js';
import db from './services/DatabaseService.js';
import airtable from './services/AirtableService.js';
import configService from './services/ConfigService.js';
import cfpService from './services/CFPService.js';
import supabaseService from './services/SupabaseService.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Utils
import { reconcileUsers } from './utils/ReconciliationEngine.js';
import { generateAgencyExcel } from './utils/ExcelGenerator.js';
import { applyPricingRules } from './utils/PricingEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Set dynamic export directory for Vercel (/tmp) vs Local (../exports)
const EXPORT_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '../exports');
if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
}
app.use('/exports', express.static(EXPORT_DIR));

// --- Auth ---
app.post('/api/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await supabaseService.getUserByEmail(email);

    // Simple plain-text password comparison
    if (!user || password !== (user.password || user.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
        { email: user.email, name: user.full_name },
        process.env.JWT_SECRET || 'nabeel-secret',
        { expiresIn: '24h' }
    );

    res.json({ token, user: { email: user.email, name: user.full_name } });
}));

// Middleware to protect routes (optional for now but good for future)
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'nabeel-secret');
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// --- Logs ---
app.get('/api/logs', asyncHandler(async (req, res) => {
    try {
        const logs = await supabaseService.getLogs();
        res.json(logs || []);
    } catch (err) {
        console.error('Supabase logs fetch failed, trying local fallback:', err.message);
        const filePath = path.join(__dirname, 'logs.json');
        const logs = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];
        res.json(logs);
    }
}));

// --- Agencies ---
app.get('/api/agencies', asyncHandler(async (req, res) => {
    try {
        const [dbAgencies, filterMapList] = await Promise.all([
            db.getAgencies(),
            airtable.getFilterList()
        ]);

        const allowedMap = new Map();
        filterMapList.forEach(a => allowedMap.set(a.id, a));

        const filteredAgencies = await Promise.all(dbAgencies
            .filter(a => allowedMap.has(a.id))
            .map(async a => {
                const airtableData = allowedMap.get(a.id);
                // Try Supabase first, then local fallback
                let localConfig;
                try {
                    localConfig = await supabaseService.getAgencyConfig(a.id);
                } catch (e) {
                    localConfig = configService.getConfig(a.id);
                }

                return {
                    ...a,
                    userPrice: airtableData.userPrice,
                    segmentPrice: airtableData.segmentPrice,
                    status: airtableData.status || a.status,
                    agreementType: airtableData.agreementType || 'Simple',
                    ...localConfig // Merge minAmount, minUsers, segmentEnabled
                };
            }));

        console.log(`Agencies Filtered & Merged: ${dbAgencies.length} -> ${filteredAgencies.length}`);

        res.json(filteredAgencies);
    } catch (err) {
        console.warn('DB Fetch failed, falling back to local storage:', err.message);
        const filePath = path.join(__dirname, 'agencies.json');
        if (fs.existsSync(filePath)) {
            const localAgencies = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            res.json(localAgencies);
        } else {
            res.status(500).json({ error: 'Failed to fetch agencies from both DB and Local' });
        }
    }
}));

app.post('/api/agencies', asyncHandler(async (req, res) => {
    const newAgency = req.body;
    const filePath = path.join(__dirname, 'agencies.json');
    let agencies = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (agencies.find(a => a.id === newAgency.id)) {
        return res.status(400).json({ error: 'Agency with this ID already exists' });
    }

    agencies.push(newAgency);
    fs.writeFileSync(filePath, JSON.stringify(agencies, null, 2));
    res.json(newAgency);
}));

app.put('/api/agencies/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { userPrice, segmentPrice, email } = req.body;
    const filePath = path.join(__dirname, 'agencies.json');
    let agencies = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    agencies = agencies.map(a => a.id === id ? { ...a, userPrice, segmentPrice, email: email || a.email } : a);
    fs.writeFileSync(filePath, JSON.stringify(agencies, null, 2));
    res.json({ success: true });
}));

app.post('/api/agency-config/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const config = req.body;
    try {
        await supabaseService.saveAgencyConfig(id, config);
    } catch (e) {
        configService.updateConfig(id, config);
    }
    res.json({ success: true });
}));

// --- Invoicing Pipeline ---

// 1. Reconcile & Load Config
app.get('/api/reconcile/:agencyId', asyncHandler(async (req, res) => {
    const { agencyId } = req.params;
    const billingPeriod = req.query.period;

    let agency;
    try {
        // Fetch base info from MySQL
        agency = await db.getAgencyById(agencyId);

        // Fetch pricing, status, and EMAIL from Airtable (Overriding MySQL/Local)
        const airtableData = await airtable.getAgencyPricing(agencyId);
        if (airtableData) {
            agency = {
                ...agency,
                userPrice: airtableData.userCharge,
                segmentPrice: airtableData.segmentCharge,
                status: airtableData.status, // This is critical for the frontend validation
                agreementType: airtableData.agreementType
            };
        }
    } catch (err) {
        console.warn('Config fetch failed, trying local:', err.message);
    }

    if (!agency) {
        const filePath = path.join(__dirname, 'agencies.json');
        const agencies = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        agency = agencies.find(a => a.id === agencyId);
    }

    // Load Persisted Config
    let localConfig;
    try {
        localConfig = await supabaseService.getAgencyConfig(agencyId);
    } catch (e) {
        localConfig = configService.getConfig(agencyId);
    }
    agency = { ...agency, ...localConfig }; // Merge config (segmentEnabled, minMonthlyAmount, etc)

    if (!agency) return res.status(404).json({ error: 'Local/DB Agency Not Found' });

    try {
        const [baserowUsers, sheetUsers, rawSegmentUsage, testEmails] = await Promise.all([
            baserow.getAllUsersByAgency(agencyId),
            sheets.getAgencyRoster(agency.sheetId, agencyId),
            swagger.getSegmentUsage(agencyId, billingPeriod),
            sheets.getTestEmails(agency.sheetId)
        ]);

        const baseReconciliation = reconcileUsers(baserowUsers, sheetUsers, billingPeriod, agency.userPrice, testEmails);

        // Apply Centralized Pricing Rules
        const { reconciliation, segmentUsage } = applyPricingRules(agency, baseReconciliation, rawSegmentUsage);

        res.json({
            reconciliation,
            segmentUsage,
            agency,
            billingPeriod,
            isGapFree: reconciliation.summary.totalMismatches === 0
        });
    } catch (error) {
        console.error('Reconciliation error:', error.message);
        res.status(500).json({
            error: error.message,
            detail: error.response?.data || 'An error occurred during reconciliation of live data.'
        });
    }
}));

// 2. Generate Excel
app.post('/api/generate-excel/:agencyId', asyncHandler(async (req, res) => {
    const { agencyId } = req.params;
    const { agency, reconciliation, segmentUsage, billingPeriod } = req.body;

    const result = generateAgencyExcel(agency, reconciliation, segmentUsage, billingPeriod);

    // Use request host for portability (works on localhost and Vercel)
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    result.downloadUrl = `${protocol}://${host}/exports/${result.fileName}`;

    res.json(result);
}));

// 3. Create Stripe Invoice (Draft)
app.post('/api/create-invoice/:agencyId', asyncHandler(async (req, res) => {
    const { agencyId } = req.params;
    const { agency, reconciliation, segmentUsage } = req.body;

    const lineItems = [
        {
            description: `User Subscriptions - ${reconciliation.summary.totalActive} Normal, ${reconciliation.summary.totalNew} New`,
            amount: reconciliation.summary.totalCharge
        },
        ...segmentUsage.map(s => ({
            description: `${s.name} - ${s.count} units`,
            amount: s.count * (agency.segmentPrice || 0.05)
        }))
    ].filter(item => item.amount > 0);

    // 1. Get correct email: Stripe Priority -> Airtable Fallback
    // STRICT RULE: No DB emails used for sending/creation if Airtable is target.
    let targetAgency = { ...agency };

    // Check Airtable to have the "Source of Truth" email ready
    const airtableAgency = await airtable.getAgencyPricing(agencyId);
    if (airtableAgency?.email) {
        targetAgency.email = airtableAgency.email;
    }

    const invoice = await stripe.createAgencyInvoice(targetAgency, lineItems);

    // Finalize the invoice immediately to generate a Hosted Preview URL
    // Note: We set auto_advance: false, so it won't send the email yet.
    const finalizedInvoice = await stripe.finalizeInvoice(invoice.id);

    res.json({
        stripeInvoiceId: finalizedInvoice.id,
        invoiceNumber: finalizedInvoice.number,
        customerEmail: finalizedInvoice.customer_email || finalizedInvoice.receipt_email,
        invoiceUrl: finalizedInvoice.hosted_invoice_url,
        dashboardUrl: `https://dashboard.stripe.com/invoices/${finalizedInvoice.id}`,
        total: finalizedInvoice.amount_due / 100
    });
}));

// --- CFP Module ---

app.get('/api/cfp-agencies', asyncHandler(async (req, res) => {
    try {
        const [dbAgencies, filterList] = await Promise.all([
            db.getAgencies(),
            airtable.getFilterList()
        ]);

        const hostAgencyIds = new Set(filterList.map(a => a.id));

        // Logic: CFP Agencies are ALL agencies MINUS Host Agencies
        const cfpAgencies = dbAgencies.filter(a => !hostAgencyIds.has(a.id));

        // Load Persisted CFP Pricing
        const configPath = path.join(__dirname, 'cfp_config.json');
        let cfpPricing = {};
        if (fs.existsSync(configPath)) {
            cfpPricing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }

        const enrichedCfpAgencies = cfpAgencies.map(a => ({
            ...a,
            userPrice: 0, // CFP doesn't charge per user usually
            segmentPrice: cfpPricing[a.id] || 5.00, // Default to $5.00
            isCFPMode: true
        }));

        res.json(enrichedCfpAgencies);
    } catch (err) {
        console.error('CFP Fetch Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch CFP agencies' });
    }
}));

app.post('/api/cfp-pricing', asyncHandler(async (req, res) => {
    const { agencyId, price } = req.body;
    const configPath = path.join(__dirname, 'cfp_config.json');

    let cfpPricing = {};
    if (fs.existsSync(configPath)) {
        cfpPricing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    cfpPricing[agencyId] = parseFloat(price);
    fs.writeFileSync(configPath, JSON.stringify(cfpPricing, null, 2));

    res.json({ success: true, price: cfpPricing[agencyId] });
}));

// 4. Send Invoice and Log
import emailService from './services/EmailService.js';

// 4. Send Invoice and Log
app.post('/api/send-invoice/:invoiceId', asyncHandler(async (req, res) => {
    const { invoiceId } = req.params;
    const { agencyId, agencyName, amount, period } = req.body;

    // 1. Send Stripe Invoice & Get PDF URL
    const stripeInvoice = await stripe.sendInvoice(invoiceId);
    const pdfUrl = stripeInvoice.invoice_pdf;

    // 2. Fetch Customer Email from Stripe for accuracy
    const stripeEmail = await stripe.getCustomerEmailFromInvoice(invoiceId);

    // 3. Send Custom Email with Excel AND PDF Attachments
    let emailSent = false;
    try {
        // Construct file path based on naming convention
        const cleanName = agencyName.replace(/[^a-zA-Z0-9]/g, '');
        const fileName = `${cleanName}-${period}.xlsx`;
        const filePath = path.join(EXPORT_DIR, fileName);

        if (fs.existsSync(filePath)) {
            // Priority 1: Email from Stripe
            // Priority 2: Email from Airtable Invoice Table
            let recipientEmail = stripeEmail;

            if (!recipientEmail) {
                console.log(`Stripe email not found for ${agencyName}, checking Airtable...`);
                const airtableAgency = await airtable.getAgencyPricing(agencyId);
                recipientEmail = airtableAgency?.email;
            }

            if (recipientEmail) {
                console.log(`Email Service: Attempting to send custom email to ${recipientEmail} with Excel and PDF...`);
                await emailService.sendInvoiceEmail(recipientEmail, agencyName, '', period, filePath, fileName, pdfUrl);
                emailSent = true;
            } else {
                console.error(`ERROR: No email found in Stripe OR Airtable for ${agencyName}. Email not sent.`);
            }
        } else {
            console.warn(`Excel file not found for email attachment: ${filePath}`);
        }
    } catch (e) {
        console.error('Failed to send custom email:', e.message);
    }

    const newLog = {
        timestamp: new Date().toISOString(),
        agencyId,
        agencyName,
        amount,
        period,
        invoiceId,
        invoiceNumber: stripeInvoice.number, // The human-friendly number (e.g. DEPTL-1001)
        invoiceType: req.body.invoiceType || 'Host',
        status: 'Sent',
        emailSent: emailSent,
        loggedInUser: req.body.loggedInUserEmail // The person who clicked Send
    };

    try {
        await supabaseService.saveLog(newLog);
    } catch (e) {
        console.warn('Supabase log save failed, using local fallback:', e.message);
        const logPath = path.join(__dirname, 'logs.json');
        const logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        logs.unshift(newLog);
        fs.writeFileSync(logPath, JSON.stringify(logs.slice(0, 100), null, 2));
    }

    res.json({ success: true, log: newLog });
}));

// 5. Batch Summary Estimator
app.post('/api/batch-summary', asyncHandler(async (req, res) => {
    const { agencyIds, billingPeriod } = req.body;
    const results = [];
    let grandTotalAll = 0;

    for (const agencyId of agencyIds) {
        try {
            let agency = await db.getAgencyById(agencyId);
            const airtableData = await airtable.getAgencyPricing(agencyId);
            if (airtableData) {
                agency = { ...agency, ...airtableData };
            }

            const localConfig = configService.getConfig(agencyId);
            agency = { ...agency, ...localConfig };

            if (!agency) continue;

            const [baserowUsers, sheetUsers, rawSegmentUsage] = await Promise.all([
                baserow.getAllUsersByAgency(agencyId),
                sheets.getAgencyRoster(agency.sheetId, agencyId),
                swagger.getSegmentUsage(agencyId, billingPeriod)
            ]);

            const baseReconciliation = reconcileUsers(baserowUsers, sheetUsers, billingPeriod, agency.userPrice, []);
            const { reconciliation, totalSegments, grandTotal } = applyPricingRules(agency, baseReconciliation, rawSegmentUsage);

            results.push({
                name: agency.name,
                totalUsers: reconciliation.summary.totalActive,
                proratedUsers: reconciliation.summary.totalNew + reconciliation.summary.totalDeactivated,
                segments: totalSegments,
                userRate: agency.userPrice,
                proratedAmount: (reconciliation.new.reduce((s, u) => s + u.charge, 0) + reconciliation.deactivated.reduce((s, u) => s + u.charge, 0)),
                total: grandTotal
            });

            grandTotalAll += grandTotal;
        } catch (err) {
            console.error(`Summary failed for ${agencyId}:`, err.message);
            results.push({
                name: `Agency ${agencyId} (Error)`,
                totalUsers: 0, segments: 0, proratedUsers: 0, userRate: 0, proratedAmount: 0, total: 0, error: err.message
            });
        }
    }

    res.json({
        period: billingPeriod,
        grandTotal: grandTotalAll,
        items: results
    });
}));

// 6. CFP Reconciliation
app.get('/api/reconcile-cfp/:agencyId', asyncHandler(async (req, res) => {
    const { agencyId } = req.params;
    let agency = await db.getAgencyById(agencyId);

    // Load CFP Pricing
    const cfpConfigPath = path.join(__dirname, 'cfp_config.json');
    if (fs.existsSync(cfpConfigPath)) {
        const cfpPrices = JSON.parse(fs.readFileSync(cfpConfigPath, 'utf8'));
        if (cfpPrices[agencyId]) {
            agency.segmentPrice = cfpPrices[agencyId];
        } else {
            agency.segmentPrice = 5.00; // Default
        }
    } else {
        agency.segmentPrice = 5.00;
    }

    // Fetch Bookings
    const bookings = await cfpService.getBookingsForAgency(agency.name);

    // Format for Frontend/Invoice
    const segmentUsage = [{
        name: 'CFP Bookings',
        count: bookings.length,
        rawData: bookings // Pass for Excel
    }];

    const reconciliation = {
        summary: {
            totalActive: 0,
            totalNew: 0,
            totalDeactivated: 0,
            totalCharge: 0, // No user fees
            totalMismatches: 0,
            note: 'CFP Mode - Usage Only'
        },
        normal: [],
        new: [],
        deactivated: [],
        mismatches: []
    };

    res.json({
        reconciliation,
        segmentUsage,
        agency,
        billingPeriod: req.query.period || new Date().toISOString().slice(0, 7),
        isGapFree: true
    });
}));

app.post('/api/batch-reconcile-cfp', asyncHandler(async (req, res) => {
    const { agencyIds } = req.body;
    const period = req.query.period || new Date().toISOString().slice(0, 7);

    // 1. Load CFP Pricing
    const cfpConfigPath = path.join(__dirname, 'cfp_config.json');
    let cfpPrices = {};
    if (fs.existsSync(cfpConfigPath)) {
        cfpPrices = JSON.parse(fs.readFileSync(cfpConfigPath, 'utf8'));
    }

    // 2. Fetch all bookings once
    const groupedBookings = await cfpService.getAllBookingsGrouped();

    const results = [];
    for (const agencyId of agencyIds) {
        try {
            const agency = await db.getAgencyById(agencyId);
            if (!agency) continue;

            agency.segmentPrice = cfpPrices[agencyId] || 5.00;
            const bookings = groupedBookings[agency.name] || [];

            results.push({
                agency,
                reconciliation: {
                    summary: {
                        totalActive: 0,
                        totalCharge: 0,
                        totalMismatches: 0,
                        note: 'CFP Mode'
                    },
                    normal: [], new: [], deactivated: [], mismatches: []
                },
                segmentUsage: [{
                    name: 'CFP Bookings',
                    count: bookings.length,
                    rawData: bookings
                }],
                billingPeriod: period
            });
        } catch (err) {
            console.error(`Batch item failed for ${agencyId}:`, err.message);
        }
    }

    res.json(results);
}));

// --- Reporting Endpoints ---

// Invoice Reports
app.get('/api/reports/invoices', asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const logs = await supabaseService.getLogs();

    const filtered = logs.filter(log => {
        if (!log.timestamp) return false;
        const logDate = new Date(log.timestamp);
        const fromDate = from ? new Date(from) : new Date('2000-01-01');
        const toDate = to ? new Date(to) : new Date();
        return logDate >= fromDate && logDate <= toDate;
    });

    const host = filtered.filter(log => log.invoiceType !== 'CFP');
    const cfp = filtered.filter(log => log.invoiceType === 'CFP');

    res.json({ host, cfp });
}));

// User Reports by Agency
app.get('/api/reports/users/:agencyId', asyncHandler(async (req, res) => {
    const { agencyId } = req.params;
    const users = await baserow.getAllUsersByAgency(agencyId);
    res.json(users);
}));

// Booking Reports
app.get('/api/reports/bookings', asyncHandler(async (req, res) => {
    try {
        // Defined sheet IDs to pull data from
        const SHEET_IDS = [
            '1hyX_k-XcE5F5WjFIwC49z0-HhHPhu8zN7r1N_DOlwsQ', // 2026 Bookings
            '14qLdZshoPWppAVVCZA4pkotYBmMEY6QtRxzAb8oY-Jk'  // 2025 Bookings
        ];

        let allRows = [];

        // Fetch from all sheets in parallel
        const results = await Promise.allSettled(
            SHEET_IDS.map(id => sheets.getRawSheetValues(id))
        );

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                allRows = [...allRows, ...result.value];
            } else {
                console.error(`Failed to fetch bookings from sheet index ${index} (${SHEET_IDS[index]}):`, result.reason);
            }
        });

        const cfpGrouped = {};
        const hostGrouped = {};

        allRows.forEach(row => {
            const userEmail = row['loggedInUserEmail'] || '';
            const status = row['tripStatus'] || '';
            const agencyName = (row['AgencyName'] || '').trim();

            // Must have valid status and agency
            if (status.toLowerCase() !== 'booked') return;
            if (!row.id && !row.TripID && !row.BookingID && !row['Trip ID']) return;
            if (!agencyName) return;

            // CFP bookings: no logged-in user
            if (userEmail.trim() === '') {
                if (!cfpGrouped[agencyName]) cfpGrouped[agencyName] = [];
                cfpGrouped[agencyName].push(row);
            }
            // Host bookings: has logged-in user
            else {
                if (!hostGrouped[agencyName]) hostGrouped[agencyName] = [];
                hostGrouped[agencyName].push(row);
            }
        });

        const cfpByAgency = Object.entries(cfpGrouped).map(([agencyName, bookings]) => ({
            agencyName,
            count: bookings.length,
            type: 'CFP'
        }));

        const hostByAgency = Object.entries(hostGrouped).map(([agencyName, bookings]) => ({
            agencyName,
            count: bookings.length,
            type: 'Host'
        }));

        const cfpCount = Object.values(cfpGrouped).reduce((sum, bookings) => sum + bookings.length, 0);
        const hostCount = Object.values(hostGrouped).reduce((sum, bookings) => sum + bookings.length, 0);

        res.json({
            total: cfpCount + hostCount,
            cfp: cfpCount,
            host: hostCount,
            cfpByAgency: cfpByAgency.sort((a, b) => b.count - a.count),
            hostByAgency: hostByAgency.sort((a, b) => b.count - a.count),
            byDate: []
        });
    } catch (err) {
        console.error('Booking report error:', err);
        res.json({ total: 0, cfp: 0, host: 0, cfpByAgency: [], hostByAgency: [], byDate: [] });
    }
}));

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

export default app;
