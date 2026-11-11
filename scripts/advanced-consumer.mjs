import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/** Every isolated consumer executes this against its installed tarball, never workspace sources. */
export function verifyAdvancedConsumer(directory) {
  writeFileSync(join(directory, 'advanced-smoke.mjs'), `
    import assert from 'node:assert/strict';
    import {createValixa,nested,collection} from 'valixa';
    const form=createValixa({a:['old'],b:['mismatch','same:a'],other:['','required'],user:nested({name:['','required']}),rows:collection({city:['','required']})});
    await form.validate();const unrelated=form.getFieldState('other');form.setValue('a','next');assert.equal(form.getFieldState('other'),unrelated);assert.deepEqual(form.dependencies.dependencies.b,['a']);
    form.setValue('b','next');form.setValue('other','ok');form.setValue('user.name','Ada');
    const rows=form.array('rows');rows.append({city:'Cairo'});const first=rows.items[0];rows.append({city:'Giza'});rows.move(0,1);assert.equal(rows.items[1],first);rows.remove(0);
    const result=await form.submit(values=>values);assert.equal(result.status,'success');assert.equal(result.data.user.name,'Ada');assert.deepEqual(result.data.rows,[{city:'Cairo'}]);
    form.setValue('user.name','');await form.validate();form.setLocale('ar');assert.equal(form.state.errors['user.name'][0],'user.name مطلوب.');assert.equal(form.state.errorDetails['user.name'][0].code,'required');form.dispose();
    const reactive=createValixa({a:[''],b:['','same:a']},{validation:{mode:'onChange'}});reactive.setValue('a','new');for(let turn=0;reactive.state.pending&&turn<100;turn++) await Promise.resolve();assert.equal(reactive.state.pending,false);assert.equal(reactive.state.errors.b,undefined);reactive.dispose();
    console.log('Installed advanced-core graph, nested paths, collections, submission and Arabic passed');
  `);
  execFileSync(process.execPath, ['advanced-smoke.mjs'], { cwd: directory, stdio: 'inherit' });
  writeFileSync(join(directory, 'advanced-types.ts'), `
    import {createValixa,nested,collection} from 'valixa';
    export const advancedForm=createValixa({user:nested({age:[0]}),rows:collection({city:['']})});
    advancedForm.setValue('user.age',1);advancedForm.array('rows').append({city:'Cairo'});
    if(false){
      // @ts-expect-error nested values stay typed in installed declarations
      advancedForm.setValue('user.age','wrong');
      // @ts-expect-error unknown nested path
      advancedForm.getFieldState('user.missing');
      // @ts-expect-error collection item values stay typed
      advancedForm.array('rows').append({city:3});
    }
  `);
}
export function attachAdvancedTypes(directory, file, additional = '') {
  const target = join(directory, file);
  const specifier = relative(dirname(target), join(directory, 'advanced-types.js')).replaceAll('\\', '/');
  writeFileSync(target, `import {advancedForm} from ${JSON.stringify(specifier.startsWith('.') ? specifier : `./${specifier}`)};\n${readFileSync(target, 'utf8')}\n${additional}\n`);
}
