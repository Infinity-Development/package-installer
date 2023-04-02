import fs from 'fs';
import unzip from 'gunzip-maybe';
import { PassThrough } from 'stream';
import { log } from './consoleLogs';
import type { LockfilePackage } from '../@types/lockfile';
import pacote from 'pacote';
import ssri from 'ssri';

/**
 * Use npm's internal "pacote" package to fetch tarballs from npm. Pacote uses
 * npm's internal cache to minimize the amount of network activity.
 */
export async function fromNetwork(
  resolved: LockfilePackage['resolved'],
  filePath: string,
): Promise<string> {
  const $integrity = ssri.integrityStream();
  const $unzip = unzip();
  const $write = fs.createWriteStream(filePath);

  const pRequest = pacote.tarball.stream(
    resolved,
    ($download) =>
      new Promise((resolve, reject) => {
        const $contents = resolved.endsWith('.tgz')
          ? $download.pipe($unzip)
          : $download;
        $download.on('end', resolve);
        $download.on('error', reject);
        $contents.pipe(new PassThrough()).pipe($write);
        $contents.pipe(new PassThrough()).pipe($integrity);
        $integrity.on('data', () => {
          /* subscribe so stream runs */
        });
      }),
  );

  const pWrite = new Promise<void>((resolve) => {
    $write.on('finish', () => {
      log.verbose(`finished writing ${resolved} to ${filePath}`);
      resolve();
    });
    $write.on('error', (err) => {
      log.error(`error writing ${resolved} to ${filePath}`, err);
      process.exit(1);
    });
  });

  const pIntegrity = new Promise<void>((resolve) => {
    $integrity.on('finish', () => {
      log.verbose(`finished getting integrity hash of ${filePath}`);
      resolve();
    });
    $integrity.on('error', (err) => {
      log.error(`error getting integrity hash of ${filePath}`, err);
      process.exit(1);
    });
  });

  const pSha512 = new Promise<string>((resolve) => {
    $integrity.on('integrity', (result) => {
      const integrity = ssri.parse(result.sha512[0]).toString();
      log.verbose(`integrity of ${resolved} is ${integrity}`);
      resolve(integrity);
    });
  });

  await Promise.all([pRequest, pIntegrity, pWrite, pSha512]);
  return pSha512;
}
