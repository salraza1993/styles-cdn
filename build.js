const fs = require('fs');
const path = require('path');
const csso = require('csso');
const sass = require('sass');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');
const tempBuildDir = path.join(__dirname, '.build-tmp');
const buildConfigPath = path.join(__dirname, 'build.config.json');
const IMPORT_FIXUPS = [
  ['forms.css', 'forms.css'],
  ['paddings.css', 'padding.css']
];

const DEFAULT_BUILD_CONFIG = {
  individualOutput: {
    mode: 'selective',
    includeTopLevelDirs: ['base', 'colors', 'components', 'utils'],
    includeFiles: [],
    excludeNamePrefixes: ['_']
  }
};

function loadBuildConfig() {
  if (!fs.existsSync(buildConfigPath)) return DEFAULT_BUILD_CONFIG;

  const rawConfig = JSON.parse(fs.readFileSync(buildConfigPath, 'utf8'));
  const userConfig = rawConfig.individualOutput ?? {};

  return {
    individualOutput: {
      mode: userConfig.mode === 'all' ? 'all' : 'selective',
      includeTopLevelDirs: Array.isArray(userConfig.includeTopLevelDirs)
        ? userConfig.includeTopLevelDirs
        : DEFAULT_BUILD_CONFIG.individualOutput.includeTopLevelDirs,
      includeFiles: Array.isArray(userConfig.includeFiles)
        ? userConfig.includeFiles
        : DEFAULT_BUILD_CONFIG.individualOutput.includeFiles,
      excludeNamePrefixes: Array.isArray(userConfig.excludeNamePrefixes)
        ? userConfig.excludeNamePrefixes
        : DEFAULT_BUILD_CONFIG.individualOutput.excludeNamePrefixes
    }
  };
}

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

function isUnderscorePrefixed(filePath) {
  return path.basename(filePath).startsWith('_');
}

function compileScssSources() {
  recreateTempBuildDir();

  const sourceFiles = getAllFiles(srcDir);

  for (const sourcePath of sourceFiles) {
    if (isUnderscorePrefixed(sourcePath)) continue;

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

  const isPartialImport = (importPath) => path.basename(importPath).startsWith('_');

  const readWithImports = (filePath) => {
    if (visited.has(filePath)) return '';
    visited.add(filePath);

    const content = fs.readFileSync(filePath, 'utf8');
    const importRegex = /^@import\s+['\"](.+?)['\"]\s*;\s*$/gm;
    const blockCommentRegex = /\/\*[\s\S]*?\*\//g;

    const replaceImports = (segment) => segment.replace(importRegex, (_, importPath) => {
      if (isPartialImport(importPath)) return '';

      const resolvedImport = resolveImportPath(importPath, filePath);
      if (!resolvedImport) {
        console.warn(`Skipped missing import: ${importPath} (from ${path.relative(__dirname, filePath)})`);
        return '';
      }

      return `${readWithImports(resolvedImport)}\n`;
    });

    let result = '';
    let lastIndex = 0;

    for (const blockMatch of content.matchAll(blockCommentRegex)) {
      const commentStart = blockMatch.index ?? 0;
      const commentText = blockMatch[0] ?? '';

      result += replaceImports(content.slice(lastIndex, commentStart));
      result += commentText;

      lastIndex = commentStart + commentText.length;
    }

    result += replaceImports(content.slice(lastIndex));
    return result;
  };

  return readWithImports(entryFile).trim() + '\n';
}

function shouldWriteIndividualFile(absPath, buildSourceDir, config) {
  const relPath = path.relative(buildSourceDir, absPath).replace(/\\/g, '/');
  const fileName = path.basename(relPath);

  if (fileName === 'index.css') return false;
  if (config.excludeNamePrefixes.some(prefix => fileName.startsWith(prefix))) return false;
  if (config.mode === 'all') return true;
  if (config.includeFiles.includes(fileName)) return true;

  const topLevelDir = relPath.split('/')[0];
  return config.includeTopLevelDirs.includes(topLevelDir);
}

function writeIndividualFiles(cssFiles, buildSourceDir, config) {
  const basenameToSource = new Map();

  for (const absPath of cssFiles) {
    const fileName = path.basename(absPath);
    if (!shouldWriteIndividualFile(absPath, buildSourceDir, config)) continue;

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
    { target: 'form-elements.css', sources: ['forms.css', 'forms.css'] }
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
    .filter(filePath => !isUnderscorePrefixed(filePath))
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
    const buildConfig = loadBuildConfig();
    const buildSourceDir = compileScssSources();
    const cssFiles = getAllCssFiles(buildSourceDir).sort();

    const basenameToSource = writeIndividualFiles(cssFiles, buildSourceDir, buildConfig.individualOutput);
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