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
 *
 * @param resolved https://registry.npmjs.org/@infinitybots/installer/-/@infinitybots/installer-0.0.1.tgz
 * @param filePath /Users/you/my-project/node_infinity/@infinitybots/installer-0.0.1.tar
 */
export async function fromNetwork(
  resolved: LockfilePackage['resolved'],
  filePath: string,
): Promise<string> {
  const $integrity = ssri.integrityStream();
  const $write = fs.createWriteStream(filePath);
  const $unzip = unzip();

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
          /** SUBSCRIBE TO STREAM RUNS */
        });
      }),
  );

  const pWrite = new Promise<void>((resolve) => {
    /** LOG THE RESULTS OF A SUCCESSFUL PACKAGE WRITE */
    $write.on('finish', () => {
      log.verbose(`Finished writing: ${resolved} to ${filePath}`);

      resolve();
    });

    /** LOG ANY ERRORS ON A FAILED PACKAGE WRITE */
    $write.on('error', (err) => {
      log.error(`Error writing: ${resolved} to ${filePath}`, err);

      process.exit(1);
    });
  });

  const pIntegrity = new Promise<void>((resolve) => {
    /** LOG THE RESULTS OF A SUCCESSFUL INTEGRITY CHECK */
    $integrity.on('finish', () => {
      log.verbose(`Finished getting integrity hash of: ${filePath}`);

      resolve();
    });

    /** LOG THE RESULTS OF A FAILED INTEGRITY CHECK */
    $integrity.on('error', (err) => {
      log.error(`Error getting integrity hash of: ${filePath}`, err);

      process.exit(1);
    });
  });

  const pSha512 = new Promise<string>((resolve) => {
    $integrity.on('integrity', (result) => {
      const integrity = ssri.parse(result.sha512[0]).toString();

      log.verbose(`Integrity of: ${resolved} is ${integrity}`);

      resolve(integrity);
    });
  });

  await Promise.all([pRequest, pIntegrity, pWrite, pSha512]);

  return pSha512;
}
