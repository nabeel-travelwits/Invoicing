import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import './server/config/env.js';

async function testSwagger() {
    const jar = new CookieJar();
    const client = wrapper(axios.create({
        jar,
        withCredentials: true,
        maxRedirects: 5,
        validateStatus: false
    }));

    const baseUrl = 'https://www.travelwitsapi.com';
    const email = 'nabeel@travelwits.com';
    const password = 'euro@9666';

    console.log(`Testing Swagger Login for ${email}...`);

    try {
        // Try the standard Login endpoint first
        const res = await client.post(`${baseUrl}/api/Account/Login`, {
            email: email,
            password: password
        });

        console.log(`Login Status: ${res.status}`);
        console.log('Cookies:', jar.toJSON().cookies.map(c => c.key).join(', '));

        if (res.status >= 200 && res.status < 400) {
            console.log('Login Successful!');

            // Try fetching the report
            console.log('\nFetching Report: /api/Reports/GenerateSegmentsReport');
            const reportRes = await client.get(`${baseUrl}/api/Reports/GenerateSegmentsReport`, {
                params: {
                    agencyId: 72,
                    startDate: '2026-01-01',
                    endDate: '2026-01-31'
                }
            });
            console.log(`Report Status: ${reportRes.status}`);
            if (reportRes.status === 200) {
                console.log('Report Fetched Successfully!');
            } else {
                console.log('Report Fetch Failed. Response Head:', String(reportRes.data).slice(0, 100));
            }
        } else {
            console.log('Login Failed. Check endpoint or credentials.');
        }
    } catch (err) {
        console.error('Error during Swagger test:', err.message);
    }
}

testSwagger();
