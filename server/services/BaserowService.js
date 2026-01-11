import axios from 'axios';

class BaserowService {
    constructor() {
        this.token = process.env.BASEROW_TOKEN;
        this.baseUrl = 'https://api.baserow.io/api';
    }

    async getAllUsersByAgency(agencyId) {
        const tableId = process.env.BASEROW_USERS_TABLE_ID;
        const includeFields = ['Email', 'Name', 'Signed Up', 'Deactivated Date', 'Active', 'TravelAgencies'];
        const fieldsParam = includeFields.join(',');

        try {
            // 1. Fetch first page to get total count
            console.log(`Baserow Service: Fetching first page for total count...`);
            const firstPageUrl = `${this.baseUrl}/database/rows/table/${tableId}/?user_field_names=true&size=200&include=${fieldsParam}`;
            const firstResponse = await axios.get(firstPageUrl, {
                headers: { Authorization: `Token ${this.token}` }
            });

            const totalCount = firstResponse.data.count;
            const totalPages = Math.ceil(totalCount / 200);
            let allRows = firstResponse.data.results;

            // 2. Fetch remaining pages in PARALLEL if needed
            if (totalPages > 1) {
                const pagePromises = [];
                for (let i = 2; i <= totalPages; i++) {
                    const pageUrl = `${firstPageUrl}&page=${i}`;
                    pagePromises.push(axios.get(pageUrl, {
                        headers: { Authorization: `Token ${this.token}` }
                    }));
                }

                console.log(`Baserow Service: Fetching remaining ${totalPages - 1} pages in parallel...`);
                const responses = await Promise.all(pagePromises);
                responses.forEach(res => {
                    allRows = allRows.concat(res.data.results);
                });
            }

            // 3. APPLY CORRECT FILTER (Client-side for 100% Accuracy)
            const filteredRows = allRows.filter(row => {
                const agencies = row.TravelAgencies || [];
                return agencies.some(a =>
                    String(a.id) === String(agencyId) ||
                    String(a.value).split(' ')[0] === String(agencyId) ||
                    String(a.value) === String(agencyId)
                );
            });

            console.log(`Baserow Service: Identified ${filteredRows.length} users for Agency ${agencyId} (from ${allRows.length} total)`);

            return filteredRows.map(row => ({
                id: row.id,
                email: row.Email,
                userId: row.id,
                name: row.Name,
                agencyId: agencyId,
                activationDate: row['Signed Up'],
                deactivationDate: row['Deactivated Date'],
                status: row.Active ? 'Active' : 'Deactivated'
            }));
        } catch (error) {
            console.error('Baserow Parallel Fetch Error:', error.response?.data || error.message);
            return [];
        }
    }
    async getAllRows() {
        const tableId = process.env.BASEROW_USERS_TABLE_ID;
        const includeFields = ['Email', 'Name', 'Signed Up', 'Deactivated Date', 'Active', 'TravelAgencies'];
        const fieldsParam = includeFields.join(',');

        try {
            const firstPageUrl = `${this.baseUrl}/database/rows/table/${tableId}/?user_field_names=true&size=200&include=${fieldsParam}`;
            const firstResponse = await axios.get(firstPageUrl, {
                headers: { Authorization: `Token ${this.token}` }
            });

            const totalCount = firstResponse.data.count;
            const totalPages = Math.ceil(totalCount / 200);
            let allRows = firstResponse.data.results;

            if (totalPages > 1) {
                const pagePromises = [];
                for (let i = 2; i <= totalPages; i++) {
                    const pageUrl = `${firstPageUrl}&page=${i}`;
                    pagePromises.push(axios.get(pageUrl, {
                        headers: { Authorization: `Token ${this.token}` }
                    }));
                }
                const responses = await Promise.all(pagePromises);
                responses.forEach(res => {
                    allRows = allRows.concat(res.data.results);
                });
            }
            return allRows;
        } catch (error) {
            console.error('Baserow Fetch Error:', error.message);
            return [];
        }
    }
}

export default new BaserowService();
