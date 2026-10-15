// Requires a RAR-capable tar (Windows tar or bsdtar) and the server's Playwright browser.
// Some supplied .png files contain WebP bytes; normalize those to real PNGs.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const league = require('../server/src/data/pgl.json');
const root = path.resolve(__dirname, '..');
const archive = path.join(root, 'PGL Logos.rar');
const tar = process.env.PGL_TAR || 'tar';
const entries = execFileSync(tar, ['-tf', archive], { encoding: 'utf8' }).split(/\r?\n/);
for (const club of league.teams) {
  const entry = `PGL Logos/${club.name}.png`;
  if (!entries.includes(entry)) throw new Error(`Missing logo: ${entry}`);
}
async function main() {
  const { chromium } = require('../server/node_modules/@playwright/test');
  const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await chromium.launch(fs.existsSync(chrome) ? { executablePath: chrome } : {});
  try {
    const page = await browser.newPage();
    for (const club of league.teams) {
      let png = execFileSync(tar, ['-xOf', archive, `PGL Logos/${club.name}.png`], { maxBuffer: 10 * 1024 * 1024 });
      if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
        if (png.subarray(0, 4).toString() !== 'RIFF' || png.subarray(8, 12).toString() !== 'WEBP') throw new Error(`Invalid image for ${club.name}`);
        const converted = await page.evaluate(src => new Promise((resolve, reject) => {
          const img = new Image(); img.onerror = () => reject(new Error('Cannot decode logo'));
          img.onload = () => {
            const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            canvas.getContext('2d').drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png').split(',')[1]);
          };
          img.src = src;
        }), 'data:image/webp;base64,' + png.toString('base64'));
        png = Buffer.from(converted, 'base64');
      }
      const output = path.join(root, 'web', club.logo);
      fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, png);
    }
    console.log(`Imported ${league.teams.length} PGL club logos`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
