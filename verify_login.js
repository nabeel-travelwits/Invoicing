import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import qs from 'qs';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function verifyLogin() {
    const jar = new CookieJar();
    const client = wrapper(axios.create({
        jar,
        withCredentials: true,
        validateStatus: () => true // Accept all status codes
    }));

    const baseUrl = 'https://www.travelwitsapi.com';
    const email = 'nabeel@travelwits.com';
    const password = 'euro@9666';

    const loginEndpoints = [
        '/Account/Login',      // Standard MVC
        '/api/Account/Login',  // Standard API
        '/Login',             // Short
        '/api/Auth/Login'     // Alternative API
    ];

    console.log('--- Testing Login Endpoints ---');

    for (const ep of loginEndpoints) {
        console.log(`\nTesting POST ${ep}...`);

        // Try JSON payload
        try {
            const res = await client.post(`${baseUrl}${ep}`, { email, password, rememberMe: true });
            console.log(`[JSON] Status: ${res.status}, Type: ${res.headers['content-type']}`);
            if (res.status < 400) {
                console.log('SUCCESS with JSON!');
                return;
            }
        } catch (e) {
            console.log('JSON Request Error:', e.message);
        }

        // Try Form payload
        try {
            const res = await client.post(`${baseUrl}${ep}`, qs.stringify({ Email: email, Password: password, RememberMe: true }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            console.log(`[FORM] Status: ${res.status}, Type: ${res.headers['content-type']}`);
            if (res.status < 400) {
                console.log('SUCCESS with FORM!');
                return;
            }
        } catch (e) {
            console.log('Form Request Error:', e.message);
        }
    }
}

verifyLogin();
