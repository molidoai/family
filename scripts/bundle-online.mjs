import {build} from 'esbuild';
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:process.cwd()},outfile:'app/src/main/assets/www/online-vendor.js',bundle:true,minify:true,format:'esm',platform:'browser',target:'es2020',legalComments:'eof'});
