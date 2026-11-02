import assert from 'node:assert/strict';

const pages = await (await fetch('http://127.0.0.1:9334/json')).json();
const page = pages.find((item) => item.type === 'page' && item.url.includes('single-dist'));
assert(page, 'Standalone page missing');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
ws.onmessage = ({data}) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
};
async function send(method, params = {}) {
  const nextId = ++id;
  const answer = new Promise((resolve) => pending.set(nextId, resolve));
  ws.send(JSON.stringify({id: nextId, method, params}));
  return await answer;
}
async function evalJS(expression) {
  const response = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  if (response.result?.exceptionDetails) throw Error(response.result.exceptionDetails.exception?.description);
  return response.result?.result?.value;
}
await send('Page.addScriptToEvaluateOnNewDocument', {source: 'window.Worker = class { constructor() { throw new Error("worker unavailable for test"); } };'});
await send('Page.reload', {ignoreCache: true});
await new Promise((resolve) => setTimeout(resolve, 1200));
assert((await evalJS('document.body.innerText')).includes('5,241'));
const result = await evalJS(`(async()=>{
  document.querySelector('.import-trigger').click();
  await new Promise(resolve=>setTimeout(resolve,100));
  const enc=new TextEncoder(), chunks=[];let size=0;
  const add=s=>{const b=enc.encode(s);chunks.push(b);size+=b.length;};
  const offsets=[0];add('%PDF-1.4\\n');
  const obj=(n,s)=>{offsets[n]=size;add(n+' 0 obj\\n'+s+'\\nendobj\\n');};
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>');
  obj(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const content='BT /F1 20 Tf 50 700 Td (apple translation placeholder) Tj ET';
  obj(5,'<< /Length '+content.length+' >>\\nstream\\n'+content+'\\nendstream');
  const xref=size;add('xref\\n0 6\\n0000000000 65535 f \\n');
  for(let n=1;n<=5;n++)add(String(offsets[n]).padStart(10,'0')+' 00000 n \\n');
  add('trailer << /Size 6 /Root 1 0 R >>\\nstartxref\\n'+xref+'\\n%%EOF');
  const pdf=new File(chunks,'text-fixture.pdf',{type:'application/pdf'});
  const dt=new DataTransfer();dt.items.add(pdf);
  const input=document.querySelector('.pdf-file-pick input');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  document.querySelector('.pdf-primary').click();
  return size;
})()`);
assert(result > 100);
let final = '';
for (let attempt=0;attempt<10;attempt++) {
  await new Promise((resolve)=>setTimeout(resolve,1000));
  final = await evalJS('document.querySelector(".pdf-modal")?.innerText || ""');
  if (final.includes('没有识别出') || final.includes('识别到') || final.includes('Setting up fake worker failed')) break;
}
assert(final.includes('没有识别出'), `Fake worker did not extract text: ${final.slice(-250)}`);
console.log('PASS: local HTML PDF.js fake-worker fallback extracted a text PDF');
ws.close();
