/**
 * Pricing Engine to handle complex pricing rules, minimums, and segment toggles.
 */

export const applyPricingRules = (agency, reconciliation, rawSegmentUsage) => {
    // 1. Segment Toggle Logic
    const segmentUsage = agency.segmentEnabled === false
        ? [{ name: 'Segments (Disabled)', count: 0 }]
        : rawSegmentUsage;

    const totalUsers = reconciliation.summary.totalActive;
    let pricingApplied = false;

    // 2. Complex Agencies: Handle Tiered/Range Pricing
    if (agency.agreementType === 'Complex') {
        // Zero out individual charges since we use a bulk range fee
        const zeroOut = (list) => list.forEach(u => u.charge = 0);
        zeroOut(reconciliation.normal);
        zeroOut(reconciliation.new);
        zeroOut(reconciliation.deactivated);
        reconciliation.summary.totalCharge = 0; // Reset before applying range

        if (agency.pricingRanges && Array.isArray(agency.pricingRanges)) {
            const match = agency.pricingRanges.find(r => totalUsers >= r.min && totalUsers <= r.max);
            if (match) {
                reconciliation.summary.totalCharge = parseFloat(match.price);
                reconciliation.summary.note = `Fixed Pricing Range Applied (${match.min}-${match.max} users: $${match.price})`;
                pricingApplied = true;
            } else {
                reconciliation.summary.note = `WARNING: No pricing range found for ${totalUsers} users!`;
            }
        } else {
            reconciliation.summary.note = 'REASON: Agreement is Complex but no Pricing Ranges are defined.';
        }
    }

    // 3. Global Minimum Logic (Applied if no Range Pricing was applied and NOT Complex)
    if (!pricingApplied && agency.agreementType !== 'Complex') {
        const minUsers = agency.minUsers || 0;
        const minAmount = agency.minMonthlyAmount || 0;

        if (minAmount > 0 && totalUsers <= minUsers) {
            reconciliation.summary.totalCharge = minAmount;
            reconciliation.summary.note = `Minimum Monthly Charge Applied (${minAmount} for <= ${minUsers} users)`;
            pricingApplied = true;
        }
    }

    // Calculate total segment cost
    const totalSegments = segmentUsage.reduce((sum, s) => sum + s.count, 0);
    const segmentPrice = agency.segmentPrice || 0.05;
    const segmentCost = totalSegments * segmentPrice;

    return {
        reconciliation,
        segmentUsage,
        totalSegments,
        segmentCost,
        grandTotal: reconciliation.summary.totalCharge + segmentCost
    };
};
