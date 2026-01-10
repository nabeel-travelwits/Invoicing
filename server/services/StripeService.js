import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class StripeService {
    async createAgencyInvoice(agency, lineItems) {
        try {
            let customer;

            // 1. First, try to find by Metadata agencyId (Most Reliable)
            const searchRes = await stripe.customers.search({
                query: `metadata['agencyId']:'${agency.id}'`,
            });

            if (searchRes.data.length > 0) {
                customer = searchRes.data[0];
                console.log(`Stripe: Found existing customer ${customer.id} via metadata agencyId.`);
            } else {
                // 2. Fallback to Email search
                const cleanEmail = (agency.email || '').toLowerCase().trim();
                if (cleanEmail) {
                    const customers = await stripe.customers.list({ email: cleanEmail, limit: 1 });
                    if (customers.data.length > 0) {
                        customer = customers.data[0];
                        console.log(`Stripe: Found existing customer ${customer.id} via email ${cleanEmail}.`);
                    }
                }
            }

            // 3. If STILL not found, we will create them using the provided email
            if (!customer) {
                const cleanEmail = (agency.email || '').toLowerCase().trim();
                console.log(`Stripe: No customer found for Agency ${agency.id}. Creating new one with email ${cleanEmail}.`);
                customer = await stripe.customers.create({
                    name: agency.name,
                    email: cleanEmail,
                    metadata: { agencyId: agency.id }
                });
            }

            const invoice = await stripe.invoices.create({
                customer: customer.id,
                auto_advance: false,
                collection_method: 'send_invoice',
                days_until_due: 7,
                metadata: { agencyId: agency.id }
            });

            for (const item of lineItems) {
                await stripe.invoiceItems.create({
                    customer: customer.id,
                    invoice: invoice.id,
                    amount: Math.round(item.amount * 100),
                    currency: 'usd',
                    description: item.description
                });
            }

            return await stripe.invoices.retrieve(invoice.id);
        } catch (error) {
            console.error('Stripe Error:', error.message);
            throw new Error(`Stripe invoice creation failed: ${error.message}`);
        }
    }

    async sendInvoice(invoiceId) {
        return await stripe.invoices.sendInvoice(invoiceId);
    }

    async finalizeInvoice(invoiceId) {
        try {
            return await stripe.invoices.finalizeInvoice(invoiceId, { auto_advance: false });
        } catch (error) {
            console.error('Stripe Finalize Error:', error.message);
            throw new Error(`Failed to finalize invoice: ${error.message}`);
        }
    }

    async getCustomerEmailFromInvoice(invoiceId) {
        try {
            const invoice = await stripe.invoices.retrieve(invoiceId);
            return invoice.customer_email || invoice.receipt_email;
        } catch (error) {
            console.error('Stripe Retrieve Error:', error.message);
            return null;
        }
    }
}

export default new StripeService();
