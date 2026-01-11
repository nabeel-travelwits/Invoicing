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

    // LOG: Login
    try {
        console.log(`LOGGING LOGIN for ${user.email}...`);
        await supabaseService.saveLog({
            agencyName: 'System',
            invoiceType: 'Auth',
            status: 'Login',
            loggedInUser: user.email,
            agencyId: '0'
        });
        console.log('LOGIN LOG SAVED SUCCESSFULLY');
    } catch (e) {
        console.error('ERROR SAVING LOGIN LOG:', e.message);
    }

    res.json({ token, user: { email: user.email, name: user.full_name } });
}));

app.get('/api/debug-log', asyncHandler(async (req, res) => {
    try {
        const log = await supabaseService.saveLog({
            agencyName: 'Debug Test',
            invoiceType: 'System',
            status: 'Manual Debug ' + new Date().toISOString(),
            agencyId: 'DEBUG'
        });
        res.json({ success: true, log });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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

app.post('/api/logs/event', asyncHandler(async (req, res) => {
    const { action, details, agencyId, agencyName, userEmail } = req.body;
    try {
        await supabaseService.saveLog({
            agencyId,
            agencyName,
            status: action,
            invoiceId: details,
            invoiceType: 'UI_Action',
            loggedInUser: userEmail || 'System'
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}));

// --- Agency Stages ---
app.get('/api/agencies/stages', asyncHandler(async (req, res) => {
    try {
        const stages = await supabaseService.getAgencyStages();
        res.json(stages);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}));

app.post('/api/agencies/stages', asyncHandler(async (req, res) => {
    const { agencyId, stage, updatedBy } = req.body;
    try {
        await supabaseService.updateAgencyStage(agencyId, stage, updatedBy);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
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

    // LOG: Agency Update
    try {
        await supabaseService.saveLog({
            timestamp: new Date().toISOString(),
            agencyId: id,
            agencyName: agencies.find(a => a.id === id)?.name || 'Unknown',
            invoiceType: 'Config',
            status: 'Updated Agency Profile',
            invoiceId: `P: ${userPrice}/${segmentPrice}, E: ${email || '-'}`,
            loggedInUser: req.body.loggedInUserEmail || 'System'
        });
    } catch (e) {
        console.warn('Silent log failure on agency update:', e.message);
    }

    res.json({ success: true });
}));

app.post('/api/agency-config/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const config = req.body;
    try {
        await supabaseService.saveAgencyConfig(id, config);
        // LOG: Config Update
        await supabaseService.saveLog({
            timestamp: new Date().toISOString(),
            agencyId: id,
            agencyName: 'Agency Config',
            invoiceType: 'Config',
            status: 'Updated Automation',
            invoiceId: Object.keys(config || {}).join(', '),
            loggedInUser: req.body.loggedInUserEmail || 'System'
        });
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

        // LOG: Reconciliation Run
        try {
            await supabaseService.saveLog({
                agencyId,
                agencyName: agency.name,
                status: 'Run Reconciliation',
                invoiceId: `Period: ${billingPeriod}`,
                invoiceType: 'Pipeline',
                loggedInUser: req.query.userEmail || 'System'
            });
        } catch (e) { }

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

    // AUTO STAGE: Draft Created
    try {
        await supabaseService.updateAgencyStage(agencyId, 'Draft Created', req.body.userEmail || 'System');
    } catch (e) { }

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

    // AUTO STAGE: Stripe Draft
    try {
        await supabaseService.updateAgencyStage(agencyId, 'Stripe Draft Created', req.body.userEmail || 'System');
    } catch (e) { }

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

    // AUTO STAGE: Sent
    try {
        await supabaseService.updateAgencyStage(agencyId, 'Invoice Sent', req.body.loggedInUserEmail || 'System');
    } catch (e) { }

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
            '1hyX_k-XcE5F5WjFIwC49z0-HhHPhu8zN7r1N_DOlwsQ' // 2026 Bookings Only
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

        const { from, to } = req.query;
        const fromDate = from ? new Date(from) : new Date('2000-01-01');
        const toDate = to ? new Date(to) : new Date();
        toDate.setHours(23, 59, 59, 999);

        // Build Email-to-Agency Map for rows with missing AgencyName
        const emailAgencyMap = new Map();
        try {
            const allBaserowUsers = await baserow.getAllRows();
            allBaserowUsers.forEach(u => {
                const email = u.Email?.toLowerCase().trim();
                const agencies = u.TravelAgencies || [];
                if (email && agencies.length > 0) {
                    // Use the first agency as primary
                    emailAgencyMap.set(email, agencies[0].value);
                }
            });
            console.log(`[Report Debug] Built attribution map for ${emailAgencyMap.size} users`);
        } catch (e) {
            console.error('[Report Debug] Failed to build attribution map:', e.message);
        }

        if (allRows.length > 0) {
            console.log('Sample Row Keys:', Object.keys(allRows[0])); // Debugging
        }

        const cfpGrouped = {};
        const hostGrouped = {};
        const statusCounts = { 'Booked': 0, 'Cancelled': 0, 'Quote': 0, 'On Hold': 0 };

        let skippedNoDate = 0;
        let skippedInvalidDate = 0;
        let skippedOutOfRange = 0;
        let skippedNoId = 0;
        let skippedNoAgency = 0;

        allRows.forEach((row, idx) => {
            // Normalize keys for consistent access
            const normalized = {};
            Object.keys(row).forEach(k => {
                const cleanKey = k.toLowerCase().replace(/\s+/g, '');
                normalized[cleanKey] = row[k];
            });

            const userEmail = normalized['loggedinuseremail'] || '';
            const status = normalized['tripstatus'] || normalized['status'] || '';
            let agencyName = (normalized['agencyname'] || normalized['agency'] || normalized['hostagency'] || normalized['travelagency'] || row['AgencyName'] || '').trim();

            // Fallback to email-based map if agency name is missing
            if (!agencyName && userEmail.trim()) {
                const mappedAgency = emailAgencyMap.get(userEmail.toLowerCase().trim());
                if (mappedAgency) {
                    agencyName = mappedAgency;
                }
            }

            if (!agencyName) {
                skippedNoAgency++;
                return;
            }

            // Date Filtering
            // Dynamic Date Key Search
            let dateStr = normalized['tripcreateddate'] || normalized['tripstartdate'] || normalized['tripcreationdate'] || normalized['bookingdate'] || normalized['date'] || normalized['created'] || normalized['tripdate'] || normalized['creationdate'] || normalized['datecreated'];

            if (!dateStr) {
                const dateKey = Object.keys(normalized).find(k =>
                    (k.includes('date') || k.includes('created')) &&
                    !k.includes('update') && !k.includes('modify') &&
                    !k.includes('checkin') && !k.includes('checkout')
                );
                if (dateKey) dateStr = normalized[dateKey];
            }

            if (!dateStr) {
                // Strict filter active
                skippedNoDate++;
                return;
            }

            let rowDate = new Date(dateStr);

            // Excel Serial Date Fallback (e.g. "45321")
            if (isNaN(rowDate.getTime()) && !isNaN(dateStr) && Number(dateStr) > 20000) {
                // Excel base date (Dec 30 1899)
                const serial = Number(dateStr);
                rowDate = new Date((serial - 25569) * 86400 * 1000);
            }

            // DD/MM/YYYY Fallback
            if (isNaN(rowDate.getTime())) {
                const parts = dateStr.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
                if (parts) {
                    rowDate = new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]));
                }
            }

            // Verbose invalid log
            if (isNaN(rowDate.getTime())) {
                skippedInvalidDate++;
                return;
            }
            if (rowDate < fromDate || rowDate > toDate) {
                skippedOutOfRange++;
                return;
            }

            const tripId = normalized['tripid'] || normalized['bookingid'] || row.id || `idx-${idx}`;

            if (!tripId) {
                skippedNoId++;
                return;
            }
            if (!agencyName) {
                skippedNoAgency++;
                return;
            }

            // Count Statuses
            const statusKey = status.toLowerCase().trim();
            if (statusKey.includes('cancel')) {
                if (!statusCounts['Cancelled']) statusCounts['Cancelled'] = 0;
                statusCounts['Cancelled']++;
            } else if (statusKey.includes('quote')) {
                if (!statusCounts['Quote']) statusCounts['Quote'] = 0;
                statusCounts['Quote']++;
            } else if (statusKey.includes('hold')) {
                if (!statusCounts['On Hold']) statusCounts['On Hold'] = 0;
                statusCounts['On Hold']++;
            } else if (statusKey.includes('booked')) {
                if (!statusCounts['Booked']) statusCounts['Booked'] = 0;
                statusCounts['Booked']++;
            }

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

        console.log(`[Report Debug] Row Processing Summary:`);
        console.log(`- Total Rows Fetched: ${allRows.length}`);
        console.log(`- Skipped (No Date Column): ${skippedNoDate}`);
        console.log(`- Skipped (Invalid Date Format): ${skippedInvalidDate}`);
        console.log(`- Skipped (Out of Date Range): ${skippedOutOfRange}`);
        console.log(`- Skipped (No Trip ID): ${skippedNoId}`);
        console.log(`- Skipped (No Agency Name): ${skippedNoAgency}`);
        console.log(`- Total Counted: ${Object.values(cfpGrouped).flat().length + Object.values(hostGrouped).flat().length}`);

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
            statuses: statusCounts,
            cfpByAgency: cfpByAgency.sort((a, b) => b.count - a.count),
            hostByAgency: hostByAgency.sort((a, b) => b.count - a.count),
            byDate: []
        });
    } catch (err) {
        console.error('Booking report error:', err);
        res.json({ total: 0, cfp: 0, host: 0, cfpByAgency: [], hostByAgency: [], byDate: [] });
    }
}));

// Agency Specific Report (Public/Private)
app.get('/api/reports/agency-details', asyncHandler(async (req, res) => {
    try {
        const { name, from, to } = req.query;
        if (!name) return res.status(400).json({ error: 'Agency Name is required' });

        const cleanName = decodeURIComponent(name).trim();

        const airtableAgencies = await airtable.getFilterList();
        const dbAgencies = await db.getAgencies();

        const norm = (str) => (str || '').toLowerCase().trim();
        const target = norm(cleanName);
        const sTarget = target.replace(/[^a-z0-9]/g, '');

        let agencyInfo = airtableAgencies.find(a => norm(a.name) === target);

        if (!agencyInfo) {
            agencyInfo = dbAgencies.find(a => norm(a.name) === target);
        }

        // Second pass: Fuzzy match if exact norm fails
        if (!agencyInfo) {
            const allAgencies = [...airtableAgencies, ...dbAgencies];
            agencyInfo = allAgencies.find(a => {
                const sName = norm(a.name).replace(/[^a-z0-9]/g, '');
                return sName === sTarget || (sName.length > 3 && sName.includes(sTarget)) || (sTarget.length > 3 && sTarget.includes(sName));
            });
        }

        console.log(`[Report Debug] Request for '${cleanName}' -> Found ID: ${agencyInfo ? agencyInfo.id : 'NOT FOUND'}${agencyInfo ? ` (${agencyInfo.name})` : ''}`);

        // Build Email-to-Agency Map (Mirroring /api/reports/bookings logic)
        const emailAgencyMap = new Map();
        try {
            const allBaserowUsers = await baserow.getAllRows();
            allBaserowUsers.forEach(u => {
                const email = u.Email?.toLowerCase().trim();
                const agencies = u.TravelAgencies || [];
                if (email && agencies.length > 0) {
                    // Use the first agency as primary
                    emailAgencyMap.set(email, agencies[0].value);
                }
            });
            console.log(`[Report Debug] Built global attribution map for ${emailAgencyMap.size} users`);
        } catch (e) {
            console.error('[Report Debug] Failed to build global attribution map:', e.message);
        }

        // Fetch Bookings (CFP + Host)
        const SHEET_IDS = [
            '1hyX_k-XcE5F5WjFIwC49z0-HhHPhu8zN7r1N_DOlwsQ' // 2026 Only
        ];

        let allBookings = [];
        const results = await Promise.allSettled(SHEET_IDS.map(id => sheets.getRawSheetValues(id)));

        results.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
                console.log(`[Report Debug] Sheet ${idx} (${SHEET_IDS[idx]}): ${result.value.length} rows`);
                allBookings = [...allBookings, ...result.value];
            } else {
                console.error(`[Report Debug] Sheet ${idx} Failed:`, result.reason);
            }
        });

        const agencyBookings = [];
        const monthlyStats = {};
        const statusCounts = {};
        // Still keep a set of users for the 'users' table in the frontend
        let usersForTable = [];
        if (agencyInfo && agencyInfo.id) {
            try {
                usersForTable = await baserow.getAllUsersByAgency(String(agencyInfo.id));
            } catch (e) { }
        }

        let skippedNoDate = 0;
        let skippedInvalidDate = 0;
        let skippedOutOfRange = 0;
        let skippedNoId = 0;
        let skippedAgencyMismatch = 0;

        const fromDate = from ? new Date(from) : new Date('2000-01-01');
        const toDate = to ? new Date(to) : new Date();
        toDate.setHours(23, 59, 59, 999);

        // Process Bookings - Normalize keys for consistent access
        console.log(`[Report Debug] Total Booking Rows Fetched: ${allBookings.length}`);

        allBookings.forEach((row, idx) => {
            // Create a normalized object
            const normalized = {};
            Object.keys(row).forEach(k => {
                const cleanKey = k.toLowerCase().replace(/\s+/g, '');
                normalized[cleanKey] = row[k];
            });

            // Extract values
            const tripId = normalized['tripid'] || normalized['bookingid'] || normalized['id'] || row.id || `idx-${idx}`;
            const userEmail = (normalized['loggedinuseremail'] || '').trim();
            const statusRaw = normalized['tripstatus'] || normalized['status'] || 'Unknown';
            const rowAgencyId = normalized['agencyid'] || normalized['travelagencyid'] || normalized['hostagencyid'] || '';

            // Resolve Agency Name using identical logic as General Report
            let resolvedAgencyName = (normalized['agencyname'] || normalized['agency'] || normalized['hostagency'] || normalized['travelagency'] || row['AgencyName'] || '').trim();

            // Fallback to email-based map if agency name is missing
            if (!resolvedAgencyName && userEmail) {
                const mappedAgency = emailAgencyMap.get(userEmail.toLowerCase());
                if (mappedAgency) resolvedAgencyName = mappedAgency;
            }

            // Matching Logic: Match by ID OR by Name
            let isMatch = false;

            // 1. Match by ID (if available)
            if (agencyInfo && agencyInfo.id && rowAgencyId) {
                if (String(rowAgencyId) === String(agencyInfo.id)) isMatch = true;
            }

            // 2. Match by Name (if ID didn't match or wasn't available)
            if (!isMatch) {
                const sRow = resolvedAgencyName.toLowerCase().replace(/[^a-z0-9]/g, '');
                const sTarget = target.replace(/[^a-z0-9]/g, ''); // 'target' is already normalized cleanName

                if (sRow === sTarget) isMatch = true;
                else if (sRow.length > 5 && sTarget.length > 5) {
                    if (sRow.includes(sTarget) || sTarget.includes(sRow)) isMatch = true;
                }
            }

            if (!isMatch) {
                skippedAgencyMismatch++;
                return;
            }

            // Date Extraction Logic
            let dateStr = normalized['tripcreateddate'] || normalized['tripstartdate'] || normalized['tripcreationdate'] || normalized['bookingdate'] || normalized['date'] || normalized['created'] || normalized['tripdate'] || normalized['creationdate'] || normalized['datecreated'];

            if (!dateStr) {
                const dateKey = Object.keys(normalized).find(k =>
                    (k.includes('date') || k.includes('created')) &&
                    !k.includes('update') && !k.includes('modify') &&
                    !k.includes('checkin') && !k.includes('checkout')
                );
                if (dateKey) dateStr = normalized[dateKey];
            }

            // Date Parsing
            let rowDate = dateStr ? new Date(dateStr) : null;
            if (dateStr && (!rowDate || isNaN(rowDate.getTime())) && !isNaN(dateStr) && Number(dateStr) > 20000) {
                const serial = Number(dateStr);
                rowDate = new Date((serial - 25569) * 86400 * 1000);
            }

            if ((!rowDate || isNaN(rowDate.getTime())) && dateStr) {
                const parts = dateStr.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
                if (parts) {
                    rowDate = new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]));
                }
            }

            const isValidDate = rowDate && !isNaN(rowDate.getTime());

            if (isValidDate) {
                if (rowDate < fromDate || rowDate > toDate) {
                    skippedOutOfRange++;
                    return;
                }
            } else {
                if (!dateStr) skippedNoDate++;
                else skippedInvalidDate++;
                return;
            }

            // Status Breakdown
            const statusKey = statusRaw.toLowerCase().trim();
            if (statusKey.includes('cancel')) {
                if (!statusCounts['Cancelled']) statusCounts['Cancelled'] = 0;
                statusCounts['Cancelled']++;
            } else if (statusKey.includes('quote')) {
                if (!statusCounts['Quote']) statusCounts['Quote'] = 0;
                statusCounts['Quote']++;
            } else if (statusKey.includes('hold')) {
                if (!statusCounts['On Hold']) statusCounts['On Hold'] = 0;
                statusCounts['On Hold']++;
            } else if (statusKey.includes('booked')) {
                if (!statusCounts['Booked']) statusCounts['Booked'] = 0;
                statusCounts['Booked']++;
            }

            const enhancedRow = {
                ...row,
                TripID: tripId,
                TripCreationDate: dateStr,
                GDSRecordLocator: normalized['gdsrecordlocator'] || normalized['gdsrecord'] || normalized['locator'],
                loggedInUserEmail: userEmail,
                Passengers: normalized['passengers'] || normalized['pax'] || '1',
                TotalAmount: normalized['totalamount'] || normalized['amount'] || '',
                Status: statusRaw
            };

            agencyBookings.push(enhancedRow);

            // Monthly Stats accumulation
            const monthKey = rowDate.toISOString().slice(0, 7); // YYYY-MM
            if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { users: 0, bookings: 0, cfp: 0, host: 0 };
            monthlyStats[monthKey].bookings += 1;
            if (!userEmail) monthlyStats[monthKey].cfp += 1;
            else monthlyStats[monthKey].host += 1;
        });

        // Process Users for Trend
        usersForTable.forEach(u => {
            if (u.activationDate) {
                const d = new Date(u.activationDate);
                if (!isNaN(d.getTime())) {
                    const monthKey = d.toISOString().slice(0, 7);
                    if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { users: 0, bookings: 0, cfp: 0, host: 0 };
                    monthlyStats[monthKey].users += 1;
                }
            }
        });

        // Format graphData
        const sortedKeys = Object.keys(monthlyStats).sort();
        const graphData = sortedKeys.map(key => ({
            month: key,
            ...monthlyStats[key]
        }));

        // Write skipped details to a debug file for analysis
        try {
            const debugPath = path.join(__dirname, 'last_agency_report_debug.json');
            fs.writeFileSync(debugPath, JSON.stringify({
                agency: cleanName,
                timestamp: new Date().toISOString(),
                allRowsCount: allBookings.length,
                validCount: agencyBookings.length,
                skipped: {
                    mismatch: skippedAgencyMismatch,
                    noDate: skippedNoDate,
                    invalidDate: skippedInvalidDate,
                    outOfRange: skippedOutOfRange,
                    noId: skippedNoId
                }
            }, null, 2));
        } catch (e) { }

        res.json({
            agencyName: cleanName,
            agencyId: agencyInfo ? agencyInfo.id : null,
            users: usersForTable,
            bookings: agencyBookings,
            statusCounts: statusCounts,
            graphData: graphData,
            summary: {
                totalUsers: usersForTable.length,
                totalBookings: agencyBookings.length,
                cfpBookings: agencyBookings.filter(b => !b.loggedInUserEmail).length,
                hostBookings: agencyBookings.filter(b => b.loggedInUserEmail).length
            }
        });
    } catch (error) {
        console.error('Agency Details Report Error:', error);
        res.status(500).json({ error: error.message });
    }
}));


// DEBUG ENDPOINT - REMOVE LATER
app.get('/api/debug/raw-bookings', asyncHandler(async (req, res) => {
    const SHEET_IDS = [
        '1hyX_k-XcE5F5WjFIwC49z0-HhHPhu8zN7r1N_DOlwsQ' // 2026 Only
    ];
    let allBookings = [];
    const results = await Promise.allSettled(SHEET_IDS.map(id => sheets.getRawSheetValues(id)));
    results.forEach(result => {
        if (result.status === 'fulfilled') allBookings = [...allBookings, ...result.value];
    });

    res.json({
        totalRows: allBookings.length,
        headers: allBookings.length > 0 ? Object.keys(allBookings[0]) : [],
        sampleRows: allBookings.slice(0, 3)
    });
}));

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

export default app;
