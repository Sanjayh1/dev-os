// Keeps public/pdf.worker.min.mjs in sync with the installed pdfjs-dist
// version. Run via postinstall since node_modules isn't committed — see
// app/contracts/[id]/results/components/PdfViewer.tsx for why this is served
// as a static file rather than bundled via webpack (Terser can't minify the
// worker's ESM output when pulled in through `new URL(...)`).
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')
const destDir = path.join(__dirname, '..', 'public')
const dest = path.join(destDir, 'pdf.worker.min.mjs')

if (!fs.existsSync(src)) {
  console.warn('pdfjs-dist worker file not found — skipping copy:', src)
  process.exit(0)
}

fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(src, dest)
console.log('Copied pdf.worker.min.mjs to public/')
