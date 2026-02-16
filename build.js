const fs = require('fs');
const path = require('path');
const csso = require('csso');
const sass = require('sass');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');
const tempBuildDir = path.join(__dirname, '.build-tmp');
const IMPORT_FIXUPS = [
  ['forms.css', 'froms.css'],
  ['paddings.css', 'padding.css']
];

function recreateDistDir() {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
}

function recreateTempBuildDir() {
  fs.rmSync(tempBuildDir, { recursive: true, force: true });
  fs.mkdirSync(tempBuildDir, { recursive: true });
}

function getAllFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(absPath));
      continue;
    }

    if (entry.isFile()) files.push(absPath);
  }

  return files;
}

function compileScssSources() {
  recreateTempBuildDir();

  const sourceFiles = getAllFiles(srcDir);

  for (const sourcePath of sourceFiles) {
    const relPath = path.relative(srcDir, sourcePath);
    const ext = path.extname(sourcePath).toLowerCase();

    if (ext === '.scss') {
      const cssRelPath = relPath.replace(/\.scss$/, '.css');
      const outPath = path.join(tempBuildDir, cssRelPath);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });

      const result = sass.compile(sourcePath, {
        style: 'expanded',
        loadPaths: [srcDir]
      });

      fs.writeFileSync(outPath, result.css, 'utf8');
      continue;
    }

    if (ext === '.css') {
      const outPath = path.join(tempBuildDir, relPath);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.copyFileSync(sourcePath, outPath);
    }
  }

  return tempBuildDir;
}

function getAllCssFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllCssFiles(absPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.css')) {
      files.push(absPath);
    }
  }

  return files;
}

function resolveImportPath(rawImportPath, fromFile) {
  const candidates = [rawImportPath];

  if (rawImportPath.endsWith('.scss')) {
    candidates.push(rawImportPath.replace(/\.scss$/, '.css'));
  }

  if (!path.extname(rawImportPath)) {
    candidates.push(`${rawImportPath}.css`);
  }

  for (const candidate of candidates) {
    const directPath = path.resolve(path.dirname(fromFile), candidate);
    if (fs.existsSync(directPath)) return directPath;
  }

  for (const [wrongName, fixedName] of IMPORT_FIXUPS) {
    for (const candidate of candidates) {
      if (!candidate.endsWith(wrongName)) continue;

      const fixedImportPath = candidate.slice(0, -wrongName.length) + fixedName;
      const fixedAbsPath = path.resolve(path.dirname(fromFile), fixedImportPath);
      if (fs.existsSync(fixedAbsPath)) return fixedAbsPath;
    }
  }

  return null;
}

function bundleFromEntry(entryFile) {
  const visited = new Set();

  const readWithImports = (filePath) => {
    if (visited.has(filePath)) return '';
    visited.add(filePath);

    const content = fs.readFileSync(filePath, 'utf8');
    const importRegex = /^@import\s+['\"](.+?)['\"]\s*;\s*$/gm;

    return content.replace(importRegex, (_, importPath) => {
      const resolvedImport = resolveImportPath(importPath, filePath);
      if (!resolvedImport) {
        console.warn(`Skipped missing import: ${importPath} (from ${path.relative(__dirname, filePath)})`);
        return '';
      }

      return `${readWithImports(resolvedImport)}\n`;
    });
  };

  return readWithImports(entryFile).trim() + '\n';
}

function writeIndividualFiles(cssFiles) {
  const basenameToSource = new Map();

  for (const absPath of cssFiles) {
    const fileName = path.basename(absPath);
    if (fileName === 'index.css') continue;

    if (basenameToSource.has(fileName)) {
      throw new Error(`Duplicate file name detected for dist output: ${fileName}`);
    }

    basenameToSource.set(fileName, absPath);
    const content = bundleFromEntry(absPath);
    fs.writeFileSync(path.join(distDir, fileName), content, 'utf8');
  }

  return basenameToSource;
}

function writeAliasFiles(basenameToSource) {
  const aliasMap = [
    { target: 'form-elements.css', sources: ['forms.css', 'froms.css'] }
  ];

  for (const alias of aliasMap) {
    const existingSourceName = alias.sources.find(source => basenameToSource.has(source));
    if (!existingSourceName) continue;

    const sourcePath = basenameToSource.get(existingSourceName);
    const content = fs.readFileSync(sourcePath, 'utf8');
    fs.writeFileSync(path.join(distDir, alias.target), content, 'utf8');
  }
}

function writeMinifiedCopies() {
  const distFiles = fs.readdirSync(distDir).filter(file => file.endsWith('.css') && !file.endsWith('.min.css'));

  for (const file of distFiles) {
    const sourcePath = path.join(distDir, file);
    const minPath = path.join(distDir, file.replace(/\.css$/, '.min.css'));
    const content = fs.readFileSync(sourcePath, 'utf8');
    fs.writeFileSync(minPath, csso.minify(content).css, 'utf8');
  }
}

function writeUtilsBundle(cssFiles) {
  const utilsFiles = cssFiles
    .filter(filePath => filePath.includes(`${path.sep}utils${path.sep}`))
    .filter(filePath => path.basename(filePath) !== 'index.css')
    .sort();

  const utilsBundle = utilsFiles
    .map(filePath => fs.readFileSync(filePath, 'utf8'))
    .join('\n')
    .trim();

  fs.writeFileSync(path.join(distDir, 'utils.css'), utilsBundle ? `${utilsBundle}\n` : '', 'utf8');
}

function build() {
  recreateDistDir();

  try {
    const buildSourceDir = compileScssSources();
    const cssFiles = getAllCssFiles(buildSourceDir).sort();

    const basenameToSource = writeIndividualFiles(cssFiles);
    writeAliasFiles(basenameToSource);
    writeUtilsBundle(cssFiles);

    const entryFile = path.join(buildSourceDir, 'index.css');
    if (!fs.existsSync(entryFile)) {
      throw new Error('Missing entry file. Add src/index.css or src/index.scss');
    }

    const bundled = bundleFromEntry(entryFile);
    fs.writeFileSync(path.join(distDir, 'uifx.css'), bundled, 'utf8');
    writeMinifiedCopies();

    console.log('Build complete ✅');
  } finally {
    fs.rmSync(tempBuildDir, { recursive: true, force: true });
  }
}

build();
