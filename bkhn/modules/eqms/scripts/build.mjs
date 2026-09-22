import { mkdir, rm, copyFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const dest = path.join(root, 'dist');
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
for (const name of ['index.html','app.js','app.css','config.js']) await copyFile(path.join(root,name),path.join(dest,name));
const files = {
  'bootstrap/dist/css/bootstrap.min.css':'bootstrap.min.css',
  'bootstrap/dist/js/bootstrap.bundle.min.js':'bootstrap.bundle.min.js',
  'jquery/dist/jquery.min.js':'jquery.min.js',
  'chart.js/dist/chart.umd.js':'chart.umd.js',
  'datatables.net/js/jquery.dataTables.min.js':'jquery.dataTables.min.js',
  'datatables.net-bs5/js/dataTables.bootstrap5.min.js':'dataTables.bootstrap5.min.js',
  'datatables.net-bs5/css/dataTables.bootstrap5.min.css':'dataTables.bootstrap5.min.css',
  '@fortawesome/fontawesome-free/css/all.min.css':'css/all.min.css'
};
for (const [src,target] of Object.entries(files)) {
  await mkdir(path.dirname(path.join(dest,'vendor',target)),{recursive:true});
  await copyFile(path.join(root,'node_modules',src),path.join(dest,'vendor',target));
}
await cp(path.join(root,'node_modules/@fortawesome/fontawesome-free/webfonts'),path.join(dest,'vendor/webfonts'),{recursive:true});
console.log('Built EQMS public assets only. Apps Script, tests and local data are excluded.');
