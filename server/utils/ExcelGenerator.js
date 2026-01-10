import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateAgencyExcel = (agency, reconciliation, segmentUsage, billingPeriod) => {
    const wb = XLSX.utils.book_new();
    const isCFP = agency.isCFPMode || segmentUsage.some(s => s.name === 'CFP Bookings');

    if (!isCFP) {
        // --- HOST AGENCY EXCEL STRUCTURE ---

        // 1. Dashboard Tab
        const dashboardData = [
            ['Invoicing Dashboard'],
            ['Agency Name', agency.name],
            ['Billing Period', billingPeriod],
            [''],
            ['Summary Metrics Table'],
            ['Metric', 'Count', 'Charge / Unit', 'Total'],
            ['Normal Users', reconciliation.summary.totalActive, agency.userPrice.toFixed(2), (reconciliation.summary.totalActive * agency.userPrice).toFixed(2)],
            ['New Users (Prorated)', reconciliation.summary.totalNew, 'Variable', reconciliation.new.reduce((sum, u) => sum + u.charge, 0).toFixed(2)],
            ['Deactivated Users (Prorated)', reconciliation.summary.totalDeactivated, 'Variable', reconciliation.deactivated.reduce((sum, u) => sum + u.charge, 0).toFixed(2)],
            ['Total Users Charge', '', '', reconciliation.summary.totalCharge.toFixed(2)],
            [''],
            ['Segment Summary Table'],
            ['Segment Type', 'Units', 'Unit Price', 'Total'],
        ];

        let totalSegmentCount = 0;
        let totalSegmentCharge = 0;
        segmentUsage.forEach(s => {
            const charge = s.count * (agency.segmentPrice || 0.05);
            totalSegmentCount += s.count;
            totalSegmentCharge += charge;
            dashboardData.push([s.name, s.count, (agency.segmentPrice || 0.05).toFixed(3), charge.toFixed(2)]);
        });

        dashboardData.push(['Total Segments', totalSegmentCount, '', totalSegmentCharge.toFixed(2)]);
        dashboardData.push([''], ['GRAND TOTAL', '', '', (reconciliation.summary.totalCharge + totalSegmentCharge).toFixed(2)]);

        const dashboardWs = XLSX.utils.aoa_to_sheet(dashboardData);
        XLSX.utils.book_append_sheet(wb, dashboardWs, 'Dashboard');

        // 2. Users Tab
        const usersData = [
            ['User Details Audit Table'],
            ['User ID / Email', 'Name', 'Status', 'Activation Date', 'Deactivation Date', 'Days Active', 'Charge'],
        ];

        const allUsers = [...reconciliation.normal, ...reconciliation.new, ...reconciliation.deactivated];
        allUsers.forEach(u => {
            usersData.push([
                u.email || u.userId,
                u.name || '',
                u.statusType,
                u.activationDate || '',
                u.deactivationDate || '',
                u.daysActive || '',
                u.charge.toFixed(2)
            ]);
        });
        const usersWs = XLSX.utils.aoa_to_sheet(usersData);
        XLSX.utils.book_append_sheet(wb, usersWs, 'Users');

        // 3. Segments Tab (Summary or Raw if available)
        const segmentsTabHeader = ['Trip ID', 'Date', 'Agency', 'Status', 'Price', 'Travelers', 'Flight', 'Hotel', 'Car'];
        let segmentsData = [segmentsTabHeader];

        // Check if we have raw segment data (often in the first segmentUsage item)
        const rawSegments = segmentUsage.find(s => s.rawData && Array.isArray(s.rawData))?.rawData || [];

        if (rawSegments.length > 0) {
            rawSegments.forEach(b => {
                segmentsData.push([
                    b.id || b.TripID || '',
                    b.Date || b.TripCreatedDate || '',
                    b.AgencyName || b.Agency || '',
                    b.tripStatus || b.Status || '',
                    b.tripPrice || b.Price || '',
                    b.travelers || b.Travelers || '',
                    b['Booked Flight'] || b.Flight || '',
                    b['Booked Hotel'] || b.Hotel || '',
                    b['Booked Car'] || b.Car || ''
                ]);
            });
        } else {
            // Fallback to summary rows if no raw data available
            segmentUsage.forEach(s => {
                segmentsData.push([s.name, s.count, '', '', '', '', '', '', '']);
            });
        }
        const segmentsWs = XLSX.utils.aoa_to_sheet(segmentsData);
        XLSX.utils.book_append_sheet(wb, segmentsWs, 'Segments');

    } else {
        // --- CFP AFFILIATE SITE EXCEL STRUCTURE ---

        // 1. Dashboard Tab
        const dashboardData = [
            ['Invoicing Dashboard'],
            ['Agency Name', agency.name],
            [''],
            ['Segment Summary Table'],
            ['Segment Type', 'Units', 'Unit Price', 'Total'],
        ];

        let totalSegments = 0;
        let totalCharge = 0;
        segmentUsage.forEach(s => {
            const charge = s.count * (agency.segmentPrice || 5.00);
            totalSegments += s.count;
            totalCharge += charge;
            // The user specifically mentioned "Segments (API Error 401)" in the prompt 
            // Possibly as a sample, but I'll use the actual name or a clean name if it's "CFP Bookings"
            const label = s.name === 'CFP Bookings' ? 'Segments Found' : s.name;
            dashboardData.push([label, s.count, (agency.segmentPrice || 5.00).toFixed(2), charge.toFixed(2)]);
        });

        dashboardData.push(['Total Segments', totalSegments, '', totalCharge.toFixed(2)]);
        dashboardData.push([''], ['GRAND TOTAL', '', '', totalCharge.toFixed(2)]);

        const dashboardWs = XLSX.utils.aoa_to_sheet(dashboardData);
        XLSX.utils.book_append_sheet(wb, dashboardWs, 'Dashboard');

        // 2. Segments Tab
        const segmentsTabHeader = ['Trip ID', 'Date', 'Agency', 'Status', 'Price', 'Travelers', 'Flight', 'Hotel', 'Car'];
        let segmentsData = [segmentsTabHeader];

        const cfpItem = segmentUsage.find(s => s.name === 'CFP Bookings');
        if (cfpItem && cfpItem.rawData) {
            cfpItem.rawData.forEach(b => {
                segmentsData.push([
                    b.id || '',
                    b.TripCreatedDate || '',
                    b.AgencyName || '',
                    b.tripStatus || '',
                    b.tripPrice || '',
                    b.travelers || '',
                    b['Booked Flight'] || '',
                    b['Booked Hotel'] || '',
                    b['Booked Car'] || ''
                ]);
            });
        }
        const segmentsWs = XLSX.utils.aoa_to_sheet(segmentsData);
        XLSX.utils.book_append_sheet(wb, segmentsWs, 'Segments');
    }

    // Save File
    const exportDir = process.env.VERCEL ? '/tmp' : path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
    }

    const cleanName = agency.name.replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `${cleanName}-${billingPeriod}.xlsx`;
    const filePath = path.join(exportDir, fileName);

    XLSX.writeFile(wb, filePath);

    return { fileName, filePath };
};
