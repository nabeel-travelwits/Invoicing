import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../agency_config.json');

class ConfigService {
    constructor() {
        this.ensureConfigFile();
    }

    ensureConfigFile() {
        if (!fs.existsSync(CONFIG_PATH)) {
            fs.writeFileSync(CONFIG_PATH, '{}', 'utf8');
        }
    }

    getConfig(agencyId) {
        this.ensureConfigFile();
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        return config[agencyId] || {
            segmentEnabled: true,
            minMonthlyAmount: 0,
            minUsers: 0
        };
    }

    updateConfig(agencyId, newConfig) {
        this.ensureConfigFile();
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

        config[agencyId] = {
            ...(config[agencyId] || { segmentEnabled: true, minMonthlyAmount: 0, minUsers: 0 }),
            ...newConfig
        };

        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        return config[agencyId];
    }
}

export default new ConfigService();
