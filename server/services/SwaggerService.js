import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import qs from 'qs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. SSL Bypass
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

class SwaggerService {
    constructor() {
        this.jar = new CookieJar();
        // 2. Pre-set the "Bearer" token from the user-provided CURL command
        // Note: This token expires. It was issued at 'iat': 1767915234 (Fri Jan 09 2026), exp: 1770507230 (Feb 2026).
        // It is valid for ~4 weeks.
        this.authToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik1USXlRelUzTkRFd09VTXlOelUxUkRKRk9USkJRamhFUlRKQk9UWTRSRUpHT0RNeVJVWkRRdyJ9.eyJodHRwczovL3RyYXZlbHdpdHMvaWQiOjMxLCJodHRwczovL3RyYXZlbHdpdHMvaWRzIjpbMSwyLDMsNCw1LDYsNyw4LDksMTAsMTEsMTIsMTQsMTYsMjAsMjEsMjMsMjQsMjcsMjgsMjksMzEsMzIsMzMsMzQsMzUsMzYsMzcsMzgsMzksNDAsNDEsNDIsNDMsNDQsNDUsNDYsNDcsNDgsNDksNTAsNTEsNTIsNTMsNTQsNTUsNTYsNTcsNTgsNTksNjAsNjEsNjIsNjMsNjQsNjUsNjYsNjcsNjgsNjksNzAsNzEsNzIsNzMsNzQsNzUsNzYsNzcsNzgsNzksODAsODEsODIsODMsODQsODYsODcsODgsODksOTAsOTEsOTIsOTMsOTQsOTUsOTYsOTcsOTgsOTksMTAwLDEwMSwxMDIsMTAzLDEwNCwxMDUsMTA2LDEwNywxMDgsMTA5LDExMCwxMTEsMTEyLDExMywxMTQsMTE1LDExNiwxMTcsMTE4LDExOSwxMjAsMTIxLDEyMiwxMjMsMTI0LDEyNSwxMjYsMTI3LDEyOCwxMjksMTMwLDEzMSwxMzIsMTMzLDEzNCwxMzUsMTM2LDEzNywxMzgsMTM5LDE0MCwxNDEsMTQyLDE0MywxNDQsMTQ1LDE0NiwxNDcsMTQ4LDE0OSwxNTAsMTUxLDE1MiwxNTMsMTU0LDE1NSwxNTYsMTU3LDE1OCwxNTksMTYwLDE2MSwxNjIsMTYzLDE2NCwxNjUsMTY2LDE2NywxNjgsMTY5LDE3MCwxNzEsMTcyLDE3MywxNzQsMTc1LDE3NiwxNzcsMTc4LDE3OSwxODAsMTgxLDE4MiwxODMsMTg0LDE4NSwxODYsMTg3LDE4OCwxODksMTkwLDE5MSwxOTIsMTkzLDE5NCwxOTYsMTk1LDE5NywxOTgsMTk5LDIwMCwyMDEsMjAyLDIwMywyMDQsMjA1LDIwNiwyMDcsMjA4LDIwOSwyMTAsMjExLDIxMiwyMTMsMjE0LDIxNSwyMTYsMjE3LDIxOCwyMTksMjIwLDEwMDEsMjIxLDIyMiwyMjMsMjI0LDIyNSwyMjYsMjI3LDIyOCwyMjksMjMwLDIzMSwyMzMsMjMyLDIzNCwyMzUsMjM2LDIzNywyMzgsMjM5LDI0MCwyNDEsMjQyLDI0MywyNDQsMjQ1LDI0NiwyNDcsMjQ4LDI0OSwyNTAsMjUxLDI1MiwyNTMsMjU0LDI1NSwyNTYsMjU3LDI1OCwyNTksMjYwLDI2MSwyNjIsMjYzLDI2NCwyNjUsMjY2LDI2NywyNjgsMjY5LDI3MCwyNzEsMjcyLDI3MywyNzQsMjc1LDI3NiwyNzcsMjc4LDI3OSwyODAsMjgxLDI4MiwyODMsMjg0LDI4NSwyODYsMjg3LDI4OCwyODksMjkwLDI5MSwyOTIsMjkzLDI5NCwyOTUsMjk2LDI5NywyOTgsMjk5LDMwMCwzMDEsMzAyLDMwMywzMDQsMzA1LDMwNiwzMDcsMzA4LDMwOSwzMTAsMzExLDMxMiwzMTMsMzE0LDMxNSwzMTYsMzE3LDMxOCwzMTksMzIwLDMyMSwzMjIsMzIzLDMyNCwzMjUsMzI2LDMyNywzMjgsMzI5LDMzMCwzMzEsMzMyLDMzMywzMzQsMzM1LDMzNiwzMzcsMzM4LDMzOSwzNDAsMzQxLDM0MiwzNDMsMzQ0LDM0NSwzNDYsMzQ3LDM0OCwzNDksMzUwLDM1MSwzNTIsMzUzLDM1NCwzNTUsMzU2LDM1NywzNTgsMzU5LDM2MCwzNjEsMzYyLDM2MywzNjQsMzY1LDM2NiwzNjcsMzY4LDM2OSwzNzAsMzcxLDM3MiwzNzMsMzc0LDM3NiwzNzcsMzc4LDM3OSwzODAsMzgxLDM4MywzODIsMzg0LDM4NSwzODYsMzg3LDM4OCwzODksMzkwLDM5MiwzOTMsMzk0LDM5NSwzOTYsMzk3LDM5OCwxMDUwLDEwOTIsMTA5MywxMTA5LDExMTAsMzk5LDQwMCw0MDEsNDAyLDQwMywxMTExLDExMTIsMTExMyw0MDQsNDA1LDQwNiw0MDcsNDA4LDQwOSw0MTAsNDExLDQxMiw0MTMsNDE1LDQxNiw0MTcsNDE4LDQxOSw0MjAsNDIxLDQyMiw0MjMsNDI0LDQyNSwxMDMwLDExMTldLCJpc3MiOiJodHRwczovL2F1dGgudHJhdmVsd2l0cy5jb20vIiwic3ViIjoiYXV0aDB8NjgyNGQ3Y2Q1NWQ0NjU5OWZlNWMwMjRhIiwiYXVkIjpbImh0dHBzOi8vZGV2LWExMHNuZTF6LmF1dGgwLmNvbS9hcGkvdjIvIiwiaHR0cHM6Ly9kZXYtYTEwc25lMXouYXV0aDAuY29tL3VzZXJpbmZvIl0sImlhdCI6MTc2NzkxNTIzNCwiZXhwIjoxNzcwNTA3MjMwLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIGFkZHJlc3MgcGhvbmUgcmVhZDpjdXJyZW50X3VzZXIgdXBkYXRlOmN1cnJlbnRfdXNlcl9tZXRhZGF0YSBkZWxldGU6Y3VycmVudF91c2VyX21ldGFkYXRhIGNyZWF0ZTpjdXJyZW50X3VzZXJfbWV0YWRhdGEgY3JlYXRlOmN1cnJlbnRfdXNlcl9kZXZpY2VfY3JlZGVudGlhbHMgZGVsZXRlOmN1cnJlbnRfdXNlcl9kZXZpY2VfY3JlZGVudGlhbHMgdXBkYXRlOmN1cnJlbnRfdXNlcl9pZGVudGl0aWVzIiwiZ3R5IjoicGFzc3dvcmQiLCJhenAiOiJNR0gzRnROZjlNamtXeFVuUUNTSGRGZWVPQ2dtM1Y1aCJ9.LBTfUmtpEC4UAapmAjQdxAvUSAl-Fq-Renr71Gi8qQ_5PuL2aTLEEiBr0PuG1u43geKQMLIihlEqY-Fw3UhonudPdX4JtN6iD5mxGCwyGyvTjZ7qcPrh777Bwkl2kBc9ZUjf66xErw3-VJxjZ8FC5tJpYegJd93Bmibn8MtNmYBSy1ldDNW39kTKb7CM3DGRFzDkXDuxNSTLilG2NxJqrZ7IvLpMJzqE8jzgXxvUBqssxOQDGW472K9lbFrUCTJljfPs5eYWs0TkEVvif78jU-nD39TvSd1dhJbmo4TC5XMogvWkdYvVM9xx73un3c5LUiKzEM_-sEa9bY_3iyLaiw';

        this.client = wrapper(axios.create({
            jar: this.jar,
            withCredentials: true,
            maxRedirects: 5,
            validateStatus: status => status < 500,
            paramsSerializer: params => qs.stringify(params, { arrayFormat: 'repeat' }),
            headers: {
                'Authorization': `Bearer ${this.authToken}`, // Injected Token
                'Accept': 'text/plain',
            }
        }));

        this.baseUrl = 'https://www.travelwitsapi.com';
    }

    async getSegmentUsage(agencyId, billingPeriod) {
        // No explicit login call needed anymore since we use the Bearer Token
        try {
            const startDate = `${billingPeriod}-01`;
            const endDate = new Date(billingPeriod + '-01');
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(0);
            const endDateStr = endDate.toISOString().split('T')[0];

            console.log(`Swagger Service: Fetching segments for Agency ${agencyId} (${startDate} to ${endDateStr}) ...`);

            // Using the EXACT Curl structure provided by user
            // POST /api/Reports/GenerateSegmentsReport?fromDate=...&toDate=...&travelAgencyIds=...&doGetReportAsExcel=...
            const response = await this.client.post(
                `${this.baseUrl}/api/Reports/GenerateSegmentsReport`,
                null,
                {
                    params: {
                        fromDate: startDate,
                        toDate: endDateStr,
                        travelAgencyIds: [parseInt(agencyId)],
                        doGetReportAsExcel: true,
                        doGetOnlyClientPortalBookings: false
                    },
                    responseType: 'arraybuffer' // We expect an Excel file
                }
            );

            if (response.status === 200) {
                console.log('Swagger Service: Report download successful. Size:', response.data.byteLength);
                return await this.parseExcelSegments(response.data);
            }

            console.warn(`Swagger Service: Fetch failed with status ${response.status}`);
            return [{ name: `Segments (Error: ${response.status})`, count: 0 }];

        } catch (error) {
            console.error('Swagger Service Exception:', error.message);
            return [{ name: 'Segments (Exception)', count: 0 }];
        }
    }

    async parseExcelSegments(buffer) {
        try {
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(buffer, { type: 'buffer' });

            // 1. Better Sheet Selection: Try to find a data-heavy sheet, ignore "Summary"
            let sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('segment') || n.toLowerCase().includes('data')) || workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // 2. Convert to JSON
            const rows = XLSX.utils.sheet_to_json(sheet);

            // 3. Stricter Row Filtering
            const validRows = rows.filter(row => {
                // Ignore rows that look like summary info (common in Swagger exports)
                const keys = Object.keys(row);
                const isSummaryRow = keys.some(k => k.includes('Logged-in') || k.includes('Total Segments'));
                if (isSummaryRow) return false;

                // A row must have at least one valid cell
                return Object.values(row).some(v => {
                    if (v === null || v === undefined) return false;
                    const s = String(v).trim();
                    return s !== '' && s !== 'undefined' && s !== 'null' && s !== '0';
                });
            });

            const count = validRows.length;
            console.log(`Swagger Service: [Sheet: ${sheetName}] Parsed ${count} segments from ${rows.length} total rows.`);
            if (rows.length > 0) console.log(`Swagger Service: Row 1 Keys: ${Object.keys(rows[0]).join(', ')}`);

            return [{ name: 'Sabre Segments', count: count, rawData: validRows }];
        } catch (err) {
            console.error('Swagger Service: Excel parse error:', err.message);
            return [{ name: 'Segments (Parse Error)', count: 0, rawData: [] }];
        }
    }
}

export default new SwaggerService();
