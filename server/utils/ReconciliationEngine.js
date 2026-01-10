import {
    startOfMonth,
    endOfMonth,
    differenceInDays,
    getDaysInMonth,
    isSameMonth,
    parseISO,
    parse,
    isValid
} from 'date-fns';

const flexibleParseDate = (dateStr) => {
    if (!dateStr) return null;

    // Try ISO first (Baserow format)
    let d = parseISO(dateStr);
    if (isValid(d)) return d;

    // Try MM/dd/yyyy (Google Sheet format)
    d = parse(dateStr, 'MM/dd/yyyy', new Date());
    if (isValid(d)) return d;

    // Try M/d/yyyy (short format)
    d = parse(dateStr, 'M/d/yyyy', new Date());
    if (isValid(d)) return d;

    return null;
};

export const reconcileUsers = (baserowUsers, sheetUsers, billingPeriod, userPrice, testEmails = []) => {
    const periodStart = startOfMonth(parseISO(billingPeriod));
    const periodEnd = endOfMonth(parseISO(billingPeriod));
    const daysInMonth = getDaysInMonth(periodStart);

    const testEmailsSet = new Set(testEmails.map(email => email.toLowerCase().trim()));

    const results = {
        normal: [],
        new: [],
        deactivated: [],
        mismatches: [],
        testUsers: [],
        cfpUsers: [],
        summary: {
            totalActive: 0,
            totalNew: 0,
            totalDeactivated: 0,
            totalMismatches: 0,
            totalTestUsers: 0,
            totalCharge: 0,
            totalCFP: 0
        }
    };

    const sheetMap = new Map();
    sheetUsers.forEach(u => {
        const emailKey = (u.email || u.userId || '').toLowerCase().trim();
        if (emailKey) sheetMap.set(emailKey, u);
    });

    const baserowMap = new Map();
    baserowUsers.forEach(u => {
        const emailKey = (u.email || u.userId || '').toLowerCase().trim();
        if (emailKey) baserowMap.set(emailKey, u);
    });

    for (const [emailKey, bUser] of baserowMap) {
        // 1. Check if it's a test user
        if (testEmailsSet.has(emailKey)) {
            results.testUsers.push({ ...bUser, statusType: 'Test User' });
            results.summary.totalTestUsers++;
            continue;
        }

        const sUser = sheetMap.get(emailKey);

        const activationDate = flexibleParseDate(bUser.activationDate);
        const deactivationDate = bUser.deactivationDate ? flexibleParseDate(bUser.deactivationDate) : null;

        const isDeactivatedInMonth = deactivationDate && isSameMonth(deactivationDate, periodStart);
        const isActivatedInMonth = activationDate && isSameMonth(activationDate, periodStart);

        // 2. Normal Charging Logic
        if (bUser.status === 'Active' && (!isActivatedInMonth || !activationDate) && sUser) {
            const charge = userPrice;
            const userData = { ...bUser, charge, statusType: 'Normal', isCFP: sUser.isCFP };
            results.normal.push(userData);
            if (sUser.isCFP) results.cfpUsers.push(userData), results.summary.totalCFP++;

            results.summary.totalCharge += charge;
            results.summary.totalActive++;
        }
        else if (isActivatedInMonth) {
            const daysActive = differenceInDays(periodEnd, activationDate) + 1;
            const charge = (daysActive / daysInMonth) * userPrice;
            const userData = { ...bUser, charge, daysActive, statusType: 'New', isCFP: sUser?.isCFP };
            results.new.push(userData);
            if (sUser?.isCFP) results.cfpUsers.push(userData), results.summary.totalCFP++;

            results.summary.totalCharge += charge;
            results.summary.totalNew++;
        }
        else if (isDeactivatedInMonth) {
            const daysActive = differenceInDays(deactivationDate, periodStart) + 1;
            const charge = (daysActive / daysInMonth) * userPrice;
            const userData = { ...bUser, charge, daysActive, statusType: 'Deactivated', isCFP: sUser?.isCFP };
            results.deactivated.push(userData);
            if (sUser?.isCFP) results.cfpUsers.push(userData), results.summary.totalCFP++;

            results.summary.totalCharge += charge;
            results.summary.totalDeactivated++;
        }

        // 3. Mismatches (Baserow Active but missing in Sheet)
        // Note: We only report mismatch if the user is supposed to be active and not new
        if (bUser.status === 'Active' && !isActivatedInMonth && !sUser) {
            results.mismatches.push({
                ...bUser,
                issue: 'Missing in Google Sheet (Both ID columns checked)',
                severity: 'Blocker'
            });
            results.summary.totalMismatches++;
        }
    }

    // 4. Mismatches (In Sheet but missing in Baserow)
    for (const [emailKey, sUser] of sheetMap) {
        if (testEmailsSet.has(emailKey)) continue;

        if (!baserowMap.has(emailKey)) {
            results.mismatches.push({
                ...sUser,
                issue: 'Missing in Baserow Lifecycle',
                severity: 'Blocker'
            });
            results.summary.totalMismatches++;
        }
    }

    return results;
};
