'use strict';

const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.argv[2] || 'sharp');

const iconDirectory = __dirname;
const previewDirectory = path.resolve(iconDirectory, '../local/icon-preview');

async function renderIcons() {
    fs.mkdirSync(previewDirectory, { recursive: true });
    const master = fs.readFileSync(path.join(iconDirectory, 'icon.svg'));
    const small = fs.readFileSync(path.join(iconDirectory, 'icon16.svg'));

    await sharp(small).png().toFile(path.join(iconDirectory, 'icon16.png'));
    await sharp(master, { density: 288 })
        .extract({ left: 64, top: 64, width: 384, height: 384 })
        .resize(40, 40)
        .extend({ top: 4, bottom: 4, left: 4, right: 4, background: '#00000000' })
        .png().toFile(path.join(iconDirectory, 'icon48.png'));
    await sharp(master).png().toFile(path.join(iconDirectory, 'icon128.png'));

    const sheet = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720">
      <rect width="1200" height="720" fill="#F1F3F8"/>
      <rect x="600" width="600" height="720" fill="#151923"/>
      <g font-family="Arial, sans-serif">
        <text x="44" y="54" fill="#101828" font-size="24" font-weight="700">Roomy</text>
        <text x="644" y="54" fill="#F8FAFC" font-size="24" font-weight="700">Open reading frame</text>
        <text x="44" y="84" fill="#667085" font-size="14">A wider space for words.</text>
        <text x="644" y="84" fill="#AAB3C3" font-size="14">New artwork · cobalt / white · vector source</text>
        <g fill="#667085" font-size="14"><text x="78" y="662">16 px</text><text x="260" y="662">48 px</text><text x="452" y="662">128 px</text></g>
        <g fill="#AAB3C3" font-size="14"><text x="678" y="662">16 px</text><text x="860" y="662">48 px</text><text x="1052" y="662">128 px</text></g>
      </g>
    </svg>`);
    const enlarged = await sharp(master, { density: 216 }).resize(384, 384).png().toBuffer();
    const items = [
        { input: enlarged, left: 108, top: 130 },
        { input: enlarged, left: 708, top: 130 }
    ];
    for (const shift of [0, 600]) {
        items.push({ input: path.join(iconDirectory, 'icon16.png'), left: shift + 88, top: 588 });
        items.push({ input: path.join(iconDirectory, 'icon48.png'), left: shift + 256, top: 572 });
        items.push({ input: path.join(iconDirectory, 'icon128.png'), left: shift + 420, top: 532 });
    }
    await sharp(sheet).composite(items).flatten({ background: '#F1F3F8' }).png()
        .toFile(path.join(previewDirectory, 'icon-preview.png'));

    for (const size of [16, 48, 128]) {
        const file = path.join(iconDirectory, `icon${size}.png`);
        const metadata = await sharp(file).metadata();
        console.log(`${path.basename(file)}: ${metadata.width}x${metadata.height}, ${metadata.channels} channels`);
    }
    console.log(`Preview: ${path.join(previewDirectory, 'icon-preview.png')}`);
}

renderIcons().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
