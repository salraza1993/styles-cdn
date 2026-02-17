const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');
const DIST_DIR = path.join(ROOT, 'dist');

function getPackageInfo() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? '';
  const match = repository.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/i);

  if (!match) {
    throw new Error('Unable to detect GitHub owner/repo from package.json repository field');
  }

  return {
    owner: match[1],
    repo: match[2],
    version: String(pkg.version)
  };
}

function getDistCssFiles() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('dist directory not found. Run "npm run build" first.');
  }

  return fs
    .readdirSync(DIST_DIR)
    .filter((fileName) => fileName.endsWith('.css'))
    .sort();
}

function getRefs(version) {
  return ['latest', version, `v${version}`];
}

async function purgeUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Purge failed (${response.status}) for ${url}`);
  }

  return response.json();
}

async function main() {
  const { owner, repo, version } = getPackageInfo();
  const files = getDistCssFiles();
  const refs = getRefs(version);

  const urls = refs.flatMap((ref) =>
    files.map((fileName) => `https://purge.jsdelivr.net/gh/${owner}/${repo}@${ref}/dist/${fileName}`)
  );

  console.log(`Purging ${urls.length} jsDelivr paths...`);

  const results = await Promise.allSettled(urls.map((url) => purgeUrl(url)));
  const failed = results
    .map((result, index) => ({ result, url: urls[index] }))
    .filter(({ result }) => result.status === 'rejected');

  if (failed.length > 0) {
    console.error(`Failed purges: ${failed.length}`);
    for (const item of failed) {
      console.error(`- ${item.url}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('jsDelivr purge complete ✅');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
