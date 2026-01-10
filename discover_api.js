import axios from 'axios';
import https from 'https';

async function fetchSwaggerJson() {
    const urls = [
        'https://www.travelwitsapi.com/swagger/v1/swagger.json',
        'https://www.travelwitsapi.com/swagger/docs/v1',
        'https://api.travelwits.com/swagger/v1/swagger.json'
    ];

    const agent = new https.Agent({ rejectUnauthorized: false });

    for (const url of urls) {
        console.log(`Fetching ${url}...`);
        try {
            const res = await axios.get(url, { httpsAgent: agent });
            console.log(`Success! Status: ${res.status}`);

            // Look for login paths
            const paths = Object.keys(res.data.paths);
            console.log('Found Paths:', paths.length);

            const loginPaths = paths.filter(p => p.toLowerCase().includes('login') || p.toLowerCase().includes('auth'));
            console.log('Login/Auth Paths:', loginPaths);

            const reportPaths = paths.filter(p => p.toLowerCase().includes('report'));
            console.log('Report Paths:', reportPaths);

            return;
        } catch (err) {
            console.log(`Failed: ${err.message}`);
            if (err.response) console.log(`Response: ${err.response.status}`);
        }
    }
}

fetchSwaggerJson();
