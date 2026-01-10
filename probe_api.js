import axios from 'axios';
import './server/config/env.js';

async function probe() {
    const targets = [
        'https://api.travelwits.com/swagger/v1/swagger.json',
        'https://www.travelwitsapi.com/swagger/v1/swagger.json',
        'https://www.travelwits.com/api/swagger/v1/swagger.json',
        'https://api.travelwits.com/api/Account/Login'
    ];

    for (const target of targets) {
        console.log(`Probing: ${target}`);
        try {
            const res = await axios.get(target, { timeout: 5000 });
            console.log(`Status: ${res.status}`);
            if (res.status === 200) console.log('MATCH FOUND!');
        } catch (err) {
            console.log(`Failed: ${err.message}`);
        }
    }
}

probe();
