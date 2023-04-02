import color from 'picocolors';
import { join, relative } from 'path';
import { fromNetwork } from './lib/fromNetwork';
import { getLockfile } from './lib/getLockfile';
import { mkdir, readdir, rm, writeFile } from 'fs/promises';
import { getSsriFromFile } from './lib/getSsriFromFile';
import { getTimeBetween } from './lib/getTimeBetween';
import { log } from './lib/consoleLogs';

const dependencies = require('../package.json');
const devdependencies = require('../package.json');

interface Options {
  directory: string;
}

export async function infinity({ directory }: Options): Promise<void> {
  const startTime = new Date();
  const { lockfilePath, lockfile } = getLockfile(directory);
  const wrapDirPath = join(directory, 'node_infinity');

  let totalAdded = 0;
  let totalDeleted = 0;

  await mkdir(wrapDirPath, { recursive: true });

  const wrapDirContents = await readdir(wrapDirPath);
  const requiredWrapDirContents: Record<string, true> = {};
  const deletions: Promise<void>[] = [];

  for (const key in lockfile.packages) {
    if (key === '') continue;
    if (!key.includes('node_modules')) continue;

    const record = lockfile.packages[key];

    if (record.link === true) continue;
    if (!record.resolved && !record.version) continue;

    const name = key.replace(/^.*node_modules\//g, '');
    const scopelessName = name.replace(/^.+\//, '');
    const resolved =
      record.resolved ||
      `https://registry.npmjs.org/${name}/-/${scopelessName}-${record.version}.tgz`;
    const wrapFileName = `${name.replace(/\//g, '_')}-${record.version}.tar`;
    const wrapFilePath = join(wrapDirPath, wrapFileName);
    const shortWrapFilePath = relative(directory, wrapFilePath);
    const isInWrapDir = wrapDirContents.includes(wrapFileName);
    const spec = `${name}@${record.version}`;

    const isAlreadyWrapped = resolved.includes('node_infinity');

    if (isAlreadyWrapped && !isInWrapDir) {
      const header = `${spec} points to ${resolved} which seems to be missing`;
      const footer = `Delete your lockfile, reinstall, then run infinity again`;

      log.error(`${header}\n${footer}`);

      process.exit(1);
    } else if (
      !isAlreadyWrapped &&
      !isInWrapDir &&
      !name.startsWith('@infinitybots')
    ) {
      const header = `Whoops hang on chief!`;
      const footer = `It looks like you are trying to install a package not related to Infinity Bot List. Unfortunately this is a custom module made to support only the Infinity Bot List Packages!`;

      log.error(`${header}\n${footer}`);

      process.exit(1);
    } else if (
      isAlreadyWrapped &&
      isInWrapDir &&
      !name.startsWith('@infinitybots')
    ) {
      const header = `Whoops hang on chief!`;
      const footer = `It looks like you are trying to install a package not related to Infinity Bot List. Unfortunately this is a custom module made to support only the Infinity Bot List Packages!`;

      log.error(`${header}\n${footer}`);

      process.exit(1);
    }

    const integrity = isInWrapDir
      ? await getSsriFromFile(wrapFilePath)
      : await fromNetwork(resolved, wrapFilePath);

    if (!isInWrapDir) {
      log.download(spec);

      totalAdded++;
    }

    record.integrity = [record.integrity, integrity].filter(Boolean).join(' ');
    record.resolved = `file:${shortWrapFilePath}`;
    requiredWrapDirContents[wrapFileName] = true;
  }

  for (const filename of wrapDirContents) {
    if (!requiredWrapDirContents[filename]) {
      const filePath = join(wrapDirPath, filename);
      const shortPath = relative(directory, filePath);

      log.deletion(shortPath);

      deletions.push(rm(filePath));

      totalDeleted++;
    }
  }

  /** THIS IS IGNORED BY NPM >= 7 */
  lockfile.dependencies = undefined;

  const nextLockFile = JSON.stringify(lockfile, null, 2);

  await Promise.all([writeFile(lockfilePath, nextLockFile), deletions]);

  console.log(
    [
      '[Infinity Package Installer]:',
      color.green(`+${totalAdded}`),
      color.red(`-${totalDeleted}`),
      color.gray(getTimeBetween(startTime, new Date())),
    ].join(' '),
  );
}
