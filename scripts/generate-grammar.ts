import { mkdirSync, readFileSync, watchFile, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

import peggy from 'peggy';

const require = createRequire(import.meta.url);

const rootDir = resolve(import.meta.dirname, '..');
const grammarPath = resolve(rootDir, 'src/parser/grammar/grammar.peggy');
const outputDir = resolve(rootDir, 'src/parser/grammar/__generated__');
const jsPath = resolve(outputDir, 'grammar.js');
const mapPath = `${jsPath}.map`;
const dtsPath = resolve(outputDir, 'grammar.d.ts');
const peggyBinDir = dirname(require.resolve('peggy/bin/peggy-cli.js'));
const templatePath = resolve(peggyBinDir, 'generated_template.d.ts');

function generate(): void {
  const grammar = readFileSync(grammarPath, 'utf-8');

  const ast = peggy.generate(grammar, {
    output: 'ast',
    format: 'es',
    grammarSource: grammarPath,
    dependencies: { '* as Nodes': '../nodes' },
  });

  mkdirSync(outputDir, { recursive: true });

  if (!ast.code) {
    throw new Error('Failed to generate code');
  }

  // JS + source map
  const { code, map } = ast.code.toStringWithSourceMap({
    file: relative(dirname(mapPath), jsPath),
  });

  const mapJson = map.toJSON();

  mapJson.sources = mapJson.sources
    .filter((s: string | null): s is string => s != null)
    .map((s: string) => relative(dirname(mapPath), s));

  writeFileSync(jsPath, `${code}//# sourceMappingURL=${relative(dirname(jsPath), mapPath)}\n`);

  writeFileSync(mapPath, JSON.stringify(mapJson));

  // DTS from peggy template
  const template = readFileSync(templatePath, 'utf-8');

  const startRule = ast.rules[0].name;

  let dts = template
    .replace('$$$StartRules$$$', `"${startRule}"`)
    .replace('$$$DefaultStartRule$$$', `"${startRule}"`);

  dts += `
declare function ParseFunction<Options extends ParseOptions<"${startRule}">>(
  input: string,
  options?: Options,
): any;

declare function ParseFunction<Options extends ParseOptions<StartRuleNames>>(
  input: string,
  options?: Options,
): any;
`;

  writeFileSync(dtsPath, dts);
}

generate();

console.log('Grammar generated successfully.');

if (process.argv.includes('--watch')) {
  console.log(`Watching ${grammarPath} for changes...`);

  watchFile(grammarPath, { interval: 200 }, () => {
    try {
      generate();
      console.log('Grammar regenerated.');
    }
    catch (error) {
      console.error('Generation failed:', error);
    }
  });
}
