import {createWorker} from 'tesseract.js';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerSource from 'pdfjs-dist/build/pdf.worker.min.mjs?raw';
import tesseractWorkerSource from 'tesseract.js/dist/worker.min.js?raw';
import tesseractCoreSource from 'tesseract.js-core/tesseract-core-lstm.wasm.js?raw';
import tesseractCoreWasm from 'tesseract.js-core/tesseract-core-lstm.wasm?url';
import englishGzip from '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?url';
import chineseGzip from '@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz?url';
import {createPdfReader} from './pdf-reader.js';

async function decodeInlineData(dataUrl: string) {
  if (!dataUrl.startsWith('data:')) return new Uint8Array(await (await fetch(dataUrl)).arrayBuffer());
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Tesseract 7's browser worker accepts inline `{code, data}` language models,
// but its initialize step reads `data` where it needs the language `code`.
// Keep the bundled worker aligned with the same local model objects.
const workerLanguageName = 'a.map((function(t){return"string"==typeof t?t:t.data})).join("+")';
if (!tesseractWorkerSource.includes(workerLanguageName)) throw new Error('OCR 引擎语言初始化格式发生变化。');
const patchedTesseractWorker = tesseractWorkerSource.replace(workerLanguageName, workerLanguageName.replace('t.data', 't.code'));
const workerBlobUrl = URL.createObjectURL(new Blob([patchedTesseractWorker], {type: 'text/javascript'}));
const corePrefix = 'async function(moduleArg={}){var moduleRtn;';
const wasmBase64 = tesseractCoreWasm.startsWith('data:') ? tesseractCoreWasm.slice(tesseractCoreWasm.indexOf(',') + 1) : '';
if (!wasmBase64 || !tesseractCoreSource.includes(corePrefix)) throw new Error('离线 OCR 引擎资源未能完整内嵌。');
const coreWithWasm = tesseractCoreSource.replace(corePrefix, `async function(moduleArg={}){moduleArg.wasmBinary=Uint8Array.from(atob("${wasmBase64}"),c=>c.charCodeAt(0));var moduleRtn;`);
// Tesseract treats a corePath ending in `.js` as an exact script URL instead
// of a directory. The fragment keeps the Blob URL identity while providing
// that suffix to its core resolver (the fragment is not sent to importScripts).
const coreBlobUrl = `${URL.createObjectURL(new Blob([coreWithWasm], {type: 'text/javascript'}))}#tesseract-core-lstm.wasm.js`;
const pdfWorkerUrl = URL.createObjectURL(new Blob([pdfWorkerSource], {type: 'text/javascript'}));
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const readPdf = createPdfReader({
  pdfjs,
  async createOcrWorker() {
    const worker = await createWorker([
      {code: 'eng', data: await decodeInlineData(englishGzip)},
      {code: 'chi_sim', data: await decodeInlineData(chineseGzip)},
    ], 1, {
      workerPath: workerBlobUrl,
      workerBlobURL: false,
      corePath: coreBlobUrl,
      cacheMethod: 'none',
      gzip: true,
      logger: () => undefined,
    });
    return {
      recognize: (canvas: HTMLCanvasElement) => worker.recognize(canvas, {}, {text: true}),
      terminate: () => worker.terminate(),
    };
  },
  async renderPageToCanvas(page: any) {
    const unscaled = page.getViewport({scale: 1});
    const scale = Math.min(2.2, 2000 / Math.max(unscaled.width, unscaled.height));
    const viewport = page.getViewport({scale});
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', {willReadFrequently: true});
    if (!context) throw new Error('浏览器无法创建本地 OCR 画布。');
    await page.render({canvasContext: context, viewport}).promise;
    return canvas;
  },
});

export default readPdf;
