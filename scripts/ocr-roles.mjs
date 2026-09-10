import { createWorker, PSM } from '../.local-tools/ocr/node_modules/tesseract.js/src/index.js';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const directory = resolve('.local-tools/listone-audit');
const worker = await createWorker('eng', 1, { cachePath: directory });
try {
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    tessedit_char_whitelist: 'PDCAorcdsBEMWT(),',
  });
  for (let page = 1; page <= Number(process.argv[2]); page++) {
    const prefix = resolve(directory, `page-${String(page).padStart(2, '0')}`);
    const { data } = await worker.recognize(`${prefix}-roles.png`, {}, { text: true, tsv: true });
    await writeFile(`${prefix}-roles.tsv`, data.tsv);
    await writeFile(`${prefix}-roles.txt`, data.text);
    console.log(`Ruoli pagina ${page}: ${data.confidence}`);
  }
} finally {
  await worker.terminate();
}
