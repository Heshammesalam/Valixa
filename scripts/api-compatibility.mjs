import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './release-lib.mjs';

const names = JSON.parse(readFileSync(join(root, 'release/package-names.json'), 'utf8'));
/** Normalize only intentional import/export module renames; selectors and types stay exact. */
export function canonicalDeclaration(text) {
  for (const [legacy, current] of Object.entries(names).sort((a, b) => b[1].length - a[1].length)) {
    const escaped = current.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(`(\\bfrom\\s*['"]|\\bimport\\s*\\(\\s*['"]|\\bimport\\s*['"])${escaped}(?=[/'"])`, 'g');
    text = text.replace(expression, (_, prefix) => `${prefix}${legacy}`);
    const generated = current.replace(/[^A-Za-z0-9_$]/g, '_'), previous = legacy.replace(/[^A-Za-z0-9_$]/g, '_');
    const declaration = `import * as ${generated} from '${legacy}';`;
    if (generated !== previous && text.includes(declaration)) {
      text = text.replace(declaration, `import * as ${previous} from '${legacy}';`);
      // ng-packagr derives local namespace aliases from package names. Preserve literals.
      text = text.split(/('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g)
        .map((part, index) => index % 2 ? part : part.replace(new RegExp(`\\b${generated}\\.`, 'g'), `${previous}.`)).join('');
    }
  }
  return text;
}
