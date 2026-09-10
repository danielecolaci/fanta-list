// Local import tool. Neither Tesseract nor PDF code is part of the Angular dependencies.
import { createWorker, PSM } from '../.local-tools/ocr/node_modules/tesseract.js/src/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve('.local-tools/listone-audit');
await mkdir(directory, { recursive: true });
const worker = await createWorker('eng', 1, { cachePath: directory });
try {
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
  for (let page = 1; page <= Number(process.argv[2]); page++) {
    const prefix = resolve(directory, `page-${String(page).padStart(2, '0')}`);
    const { data } = await worker.recognize(`${prefix}-native.png`, {}, { text: true, tsv: true });
    await writeFile(`${prefix}-tesseract.tsv`, data.tsv);
    await writeFile(`${prefix}-tesseract.txt`, data.text);
    console.log(`OCR pagina ${page}: confidenza ${data.confidence}`);
  }
} finally {
  await worker.terminate();
}
