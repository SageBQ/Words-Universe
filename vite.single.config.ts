import {defineConfig, type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function singleFile(): Plugin {
  return {
    name: 'lexicon-single-file',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlAsset = bundle['index.html'];
      if (!htmlAsset || htmlAsset.type !== 'asset') return;

      let html = String(htmlAsset.source);
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === 'chunk' && output.isEntry) {
          // PDF.js can fall back to a same-thread worker on local file pages.
          // Vite leaves this preload placeholder unresolved in that path;
          // the single-file build has no companion chunks to preload.
          const inlineCode = output.code.replace(/\b__VITE_PRELOAD__\b/g, '[]');
          html = html.replace(
            new RegExp(`<script[^>]+src=["']/?${escapeRegExp(fileName)}["'][^>]*></script>`),
            // A bundled dependency may contain a literal `</script>` in a
            // string. Escape the closing sequence before embedding the chunk
            // so the HTML parser cannot terminate the inline script early.
            () => `<script type="module">window.addEventListener('DOMContentLoaded',()=>{${inlineCode.replace(/<\/(script)/gi, () => String.raw`<\\x2Fscript`)}});</script>`,
          );
          delete bundle[fileName];
        } else if (output.type === 'asset' && fileName.endsWith('.css')) {
          html = html.replace(
            new RegExp(`<link[^>]+href=["']/?${escapeRegExp(fileName)}["'][^>]*>`),
            () => `<style>${String(output.source)}</style>`,
          );
          delete bundle[fileName];
        }
      }

      html = html
        .replace(/<link rel="icon"[^>]*>/, '')
        .replace(/<meta property="og:image"[^>]*>/, '');

      // Protect any closing-script text that may have been introduced by
      // dependency/runtime strings during HTML assembly. Keep the final
      // actual tag intact so the browser can parse the document normally.
      const finalScriptClose = html.lastIndexOf('</script>');
      if (finalScriptClose >= 0) {
        html = html.slice(0, finalScriptClose).replace(
          /<\/(script)/gi,
          () => String.raw`<\\x2Fscript`,
        ) + html.slice(finalScriptClose);
      }
      htmlAsset.source = html;
    },
  };
}

export default defineConfig({
  root: 'backup',
  publicDir: false,
  plugins: [react(), singleFile()],
  css: {postcss: {plugins: [tailwindcss()]}},
  build: {outDir: '../single-dist', emptyOutDir: true, assetsInlineLimit: 12_000_000},
});
