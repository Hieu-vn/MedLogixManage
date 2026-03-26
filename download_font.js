import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = 'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf';
const dest = path.join(__dirname, 'src', 'lib', 'Roboto-Regular.js');

https.get(url, (res) => {
    let chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        const content = `export const ROBOTO_BASE64 = "${base64}";\n`;
        fs.writeFileSync(dest, content);
        console.log('Font successfully downloaded and converted to Base64 in src/lib/Roboto-Regular.js');
    });
}).on('error', (e) => {
    console.error('Error downloading font:', e);
});
