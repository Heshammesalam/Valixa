import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalDeclaration } from '../scripts/api-compatibility.mjs';
import { packageName, packages, publicationOrder } from '../scripts/release-lib.mjs';

test('approved public names retain all packages and dependency publication order', () => {
  assert.equal(packageName('core'), 'valixa');
  assert.equal(packageName('angular-material'), 'valixa-angular-material');
  assert.equal(packages.length, 11);
  const order = publicationOrder(), names = new Set(order.map(item => item.manifest.name)), seen = new Set();
  for (const item of order) {
    assert.equal(item.manifest.name, packageName(item.folder));
    assert(!item.manifest.name.startsWith('@'));
    for (const dependency of Object.keys({ ...item.manifest.dependencies, ...item.manifest.peerDependencies })) if (names.has(dependency)) assert(seen.has(dependency));
    seen.add(item.manifest.name);
  }
});
test('compatibility normalization accepts module renames but cannot hide selector or type changes', () => {
  assert.equal(canonicalDeclaration("import {X} from 'valixa-react/auto';"), "import {X} from '@valixa/react/auto';");
  assert.equal(canonicalDeclaration('type T = import("valixa").ValixaForm<{}>;'), 'type T = import("@valixa/core").ValixaForm<{}>;');
  const selector = 'type Selector = "valixa-devtools"; type Value = number;';
  assert.equal(canonicalDeclaration(selector), selector);
  assert.notEqual(canonicalDeclaration(selector.replace('number', 'string')), selector);
  assert.equal(canonicalDeclaration("import {X} from 'valixa-extra';"), "import {X} from 'valixa-extra';");
  assert.equal(canonicalDeclaration("import * as valixa from 'valixa';\ntype T = valixa.Field; type Literal = 'valixa.Field';"), "import * as _valixa_core from '@valixa/core';\ntype T = _valixa_core.Field; type Literal = 'valixa.Field';");
});
