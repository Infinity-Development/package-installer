export interface Lockfile {
  name: string;
  version: string;
  lockfileVersion: null | 1 | 2 | 3 | '1' | '2' | '3';
  requires: boolean;
  packages: Record<string, LockfilePackage>;
  dependencies?: Record<string, unknown>;
}

export interface LockfilePackage {
  dependencies?: Record<string, string>;
  engines?: Record<string, string>;
  from?: string;
  hasInstallScript?: true;
  integrity: string;
  license: string;
  link?: true;
  name: string;
  optional?: true;
  os?: string[];
  resolved: string;
  version: string;
}
