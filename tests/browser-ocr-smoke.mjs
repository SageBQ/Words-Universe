import assert from 'node:assert/strict';

const pages = await (await fetch('http://127.0.0.1:9334/json')).json();
const page = pages.find((item) => item.type === 'page' && item.url.includes('single-dist'));
assert(page, 'Standalone page missing');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let counter = 0;
const pending = new Map();
const logs = [];
ws.onmessage = ({data}) => {
  const message = JSON.parse(data);
  if (message.id) {
    const item = pending.get(message.id);
    if (item) { pending.delete(message.id); item.resolve(message); }
  }
  if (message.method === 'Runtime.consoleAPICalled') {
    const line = message.params.args.map((arg) => arg.value ?? arg.description ?? (arg.preview ? JSON.stringify(arg.preview.properties) : '')).join(' ');
    logs.push(line);
    if (line.includes('OCR progress')) console.log(line.slice(0, 300));
  }
  if (message.method === 'Runtime.exceptionThrown') console.log('EXCEPTION', message.params.exceptionDetails.exception?.description?.slice(0,500) ?? message.params.exceptionDetails.text);
};
async function send(method, params = {}) {
  const id = ++counter;
  const response = new Promise((resolve) => pending.set(id, {resolve}));
  ws.send(JSON.stringify({id, method, params}));
  return await response;
}
async function evalJS(expression) {
  const response = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  if (response.result?.exceptionDetails) throw Error(JSON.stringify(response.result.exceptionDetails));
  return response.result?.result?.value;
}
await send('Runtime.enable');
await new Promise((resolve) => setTimeout(resolve, 1000));
if (process.argv.includes('--inspect-only')) {
  console.log('FIELDS', await evalJS('Array.from(document.querySelectorAll(".pdf-modal input")).map(x=>x.value)'));
  ws.close();
  process.exit(0);
}
assert((await evalJS('document.body.innerText')).includes('5,241'), 'Built-in catalogue did not render');
const fixture = `(async () => {
  document.querySelector('.import-trigger').click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const c = document.createElement('canvas'); c.width=2400; c.height=600;
  const x=c.getContext('2d'); x.fillStyle='white'; x.fillRect(0,0,c.width,c.height);
  x.fillStyle='black'; x.font='88px Arial'; x.fillText('apple n. 苹果',120,220); x.fillText('banana n. 香蕉',120,430);
  const image=atob(c.toDataURL('image/jpeg',0.94).split(',')[1]);
  const enc=new TextEncoder(); const parts=[]; let size=0;
  const add=(s)=>{const bytes=typeof s==='string'?enc.encode(s):s; parts.push(bytes);size+=bytes.length;};
  add('%PDF-1.4\\n'); const offsets=[0];
  const obj=(id,s)=>{offsets[id]=size;add(id+' 0 obj\\n'+s+'\\nendobj\\n');};
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 300] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>');
  offsets[4]=size;add('4 0 obj\\n<< /Type /XObject /Subtype /Image /Width 2400 /Height 600 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+image.length+' >>\\nstream\\n');
  const img=new Uint8Array(image.length);for(let i=0;i<image.length;i++)img[i]=image.charCodeAt(i);add(img);add('\\nendstream\\nendobj\\n');
  const stream='q 1200 0 0 300 0 0 cm /Im1 Do Q';
  obj(5,'<< /Length '+stream.length+' >>\\nstream\\n'+stream+'\\nendstream');
  const xref=size;add('xref\\n0 6\\n0000000000 65535 f \\n');
  for(let i=1;i<=5;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \\n');
  add('trailer << /Size 6 /Root 1 0 R >>\\nstartxref\\n'+xref+'\\n%%EOF');
  const blob=new Blob(parts,{type:'application/pdf'});
  const dt=new DataTransfer();dt.items.add(new File([blob],'ocr-fixture.pdf',{type:'application/pdf'}));
  const input=document.querySelector('.pdf-file-pick input');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  document.querySelector('.pdf-primary').click();
  return blob.size;
})()`;
assert((await evalJS(fixture)) > 1000, 'Synthetic PDF was not created');
let found = false;
for (let i=0;i<12;i++) {
  await new Promise((resolve)=>setTimeout(resolve,5000));
  const state=await evalJS('document.body.innerText.slice(-700)');
  if (state.includes('识别到')) {
    const fields = await evalJS('Array.from(document.querySelectorAll(".pdf-word-row input")).map(x=>x.value)');
    assert.deepEqual(fields, ['apple', '苹果']);
    found = true;
    break;
  }
}
assert(found, `OCR did not reach review: ${logs.slice(-3).join(' | ')}`);
await evalJS('document.querySelector(".pdf-primary").click()');
await new Promise((resolve)=>setTimeout(resolve,300));
assert((await evalJS('document.body.innerText')).includes('ocr-fixture'), 'Imported book title missing');
assert(!(await evalJS('document.body.innerText')).includes('5,241'), 'Imported catalogue was not activated');
await evalJS(fixture);
let appendReady = false;
for (let i=0;i<12;i++) {
  await new Promise((resolve)=>setTimeout(resolve,1000));
  if (await evalJS('Array.from(document.querySelectorAll(".pdf-modal button")).some(x=>x.textContent.includes("追加本批"))')) {appendReady = true; break;}
}
assert(appendReady, 'Second page range cannot be appended');
await evalJS('Array.from(document.querySelectorAll(".pdf-modal button")).find(x=>x.textContent.includes("追加本批")).click()');
await new Promise((resolve)=>setTimeout(resolve,300));
assert(!(await evalJS('document.body.innerText')).includes('5,241'), 'Appending returned to the built-in catalogue');
await evalJS('Array.from(document.querySelectorAll("button")).find(x=>x.textContent.includes("恢复内置词书")).click()');
await new Promise((resolve)=>setTimeout(resolve,300));
assert((await evalJS('document.body.innerText')).includes('5,241'), 'Restore did not recover the built-in catalogue');
console.log('PASS: standalone file rendered, OCR review, import, batch append, and restore worked');
ws.close();
