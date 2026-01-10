import swagger from './server/services/SwaggerService.js';
import './server/config/env.js';

async function run() {
    console.log('Testing Swagger Service with Excel parsing...');
    try {
        // Agency 72 (Pique Travel), Billing Period 2026-01 (as seen in user screenshot attempts)
        const results = await swagger.getSegmentUsage(72, '2026-01');
        console.log('Final Results:', JSON.stringify(results, null, 2));
    } catch (e) {
        console.error('Test Failed:', e);
    }
}
run();
