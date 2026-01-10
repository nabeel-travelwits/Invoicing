import nodemailer from 'nodemailer';
import axios from 'axios';

class EmailService {
    constructor() {
        // Using existing credentials from .env if available, or fallback to standard transport
        if (process.env.SMTP_HOST) {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        }
    }

    async sendInvoiceEmail(toEmail, agencyName, invoiceUrl, period, excelPath, excelName, pdfUrl) {
        if (!this.transporter) {
            console.warn('EmailService: No SMTP configuration found. Skipping email send.');
            return false;
        }

        const subject = `Invoice for ${agencyName} - ${period}`;
        const ccList = ['nabeel@travelwits.com', 'saira@travelwits.com'];

        const htmlContent = `
            <p>Hi ${agencyName} Team,</p>
            <p>I hope you are doing well. Please find the attached invoice and breakdown details.</p>
            <p>The invoice covers the period of <strong>${period}</strong>. We have attached both the **Stripe Invoice (PDF)** and the **Detailed Breakdown (Excel)** for your records.</p>
            <p>To pay this invoice, you can also refer to the separate email from Stripe or use the link in the attached PDF.</p>
            <p>If you have any questions regarding the invoice, please feel free to contact me at any time.</p>
            <br>
            <p>Regards,</p>
            <p>TravelWits Accounts</p>
        `;

        const attachments = [
            {
                filename: excelName,
                path: excelPath
            }
        ];

        // Add PDF attachment if URL is provided
        if (pdfUrl) {
            try {
                console.log(`Email Service: Downloading PDF from Stripe...`);
                const response = await axios.get(pdfUrl, { responseType: 'arraybuffer', timeout: 10000 });
                attachments.push({
                    filename: `Invoice-${agencyName}-${period}.pdf`,
                    content: Buffer.from(response.data)
                });
                console.log(`Email Service: PDF download successful.`);
            } catch (err) {
                console.error(`Email Service: Failed to download PDF from URL. Email will be sent without PDF.`, err.message);
            }
        }

        try {
            console.log(`Email Service: Sending email to ${toEmail}...`);
            const info = await this.transporter.sendMail({
                from: '"TravelWits Billing" <billing@travelwits.com>',
                to: toEmail,
                cc: ccList,
                subject: subject,
                html: htmlContent,
                attachments: attachments
            });

            console.log(`Email sent: ${info.messageId}`);
            return true;
        } catch (error) {
            console.error('EmailService Error during sendMail:', error.message);
            throw error;
        }
    }
}

export default new EmailService();
