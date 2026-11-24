import { loadEnvConfig } from '@next/env';

// Resolve the same development-mode .env precedence used by the installed Next
// runtime before inspecting DATABASE_URL or initializing Prisma. Vitest sets
// NODE_ENV=test, so temporarily select development mode to include .env.local.
const originalNodeEnv = process.env.NODE_ENV;
const hadNodeEnv = Object.prototype.hasOwnProperty.call(process.env, 'NODE_ENV');
let environmentLoadFailed = false;
try {
  process.env.NODE_ENV = 'development';
  loadEnvConfig(process.cwd(), true, {
    info: () => {},
    error: () => { environmentLoadFailed = true; },
  }, true);
} catch {
  environmentLoadFailed = true;
} finally {
  if (hadNodeEnv) process.env.NODE_ENV = originalNodeEnv;
  else delete process.env.NODE_ENV;
}
if (environmentLoadFailed) {
  throw new Error('Could not resolve application environment configuration safely.');
}

const rawTestDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!rawTestDatabaseUrl) {
  throw new Error('Integration tests require TEST_DATABASE_URL.');
}

const RELEVANT_MONGODB_PARAMETERS = new Set([
  'authsource',
  'directconnection',
  'loadbalanced',
  'replicaset',
  'srvmaxhosts',
  'srvservicename',
  'ssl',
  'tls',
]);

type NormalizedMongoTarget = {
  protocol: 'mongodb:' | 'mongodb+srv:';
  host: string;
  port: string | null;
  databaseName: string;
  relevantParameters: Map<string, string>;
};

const normalizeMongoTarget = (rawUrl: string): NormalizedMongoTarget => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid MongoDB connection URL.');
  }

  if (url.protocol !== 'mongodb:' && url.protocol !== 'mongodb+srv:') {
    throw new Error('Unsupported MongoDB connection scheme.');
  }
  if (url.hostname.includes(',')) {
    throw new Error('Multi-host MongoDB URLs cannot be compared safely.');
  }
  if (url.protocol === 'mongodb+srv:' && url.port) {
    throw new Error('An SRV MongoDB URL cannot include a port.');
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error('Invalid MongoDB database path.');
  }
  if (!databaseName || databaseName.includes('/')) {
    throw new Error('MongoDB URL must identify one unambiguous database.');
  }

  const relevantParameters = new Map<string, string>();
  for (const [rawName, value] of url.searchParams.entries()) {
    const name = rawName.toLowerCase();
    if (!RELEVANT_MONGODB_PARAMETERS.has(name)) continue;
    const canonicalName = name === 'ssl' ? 'tls' : name;
    if (relevantParameters.has(canonicalName)) {
      throw new Error('MongoDB URL contains ambiguous connection parameters.');
    }
    if (['authsource', 'replicaset', 'srvservicename'].includes(canonicalName) && !value.trim()) {
      throw new Error('MongoDB URL contains an empty connection parameter.');
    }
    if (['directconnection', 'loadbalanced', 'tls'].includes(canonicalName) && !/^(true|false)$/i.test(value)) {
      throw new Error('MongoDB URL contains an invalid boolean connection parameter.');
    }
    if (canonicalName === 'srvmaxhosts' && !/^\d+$/.test(value)) {
      throw new Error('MongoDB URL contains an invalid SRV host limit.');
    }
    relevantParameters.set(canonicalName, value);
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const host = ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ? 'loopback' : hostname;
  return {
    protocol: url.protocol,
    host,
    port: url.protocol === 'mongodb:' ? url.port || '27017' : null,
    databaseName,
    relevantParameters,
  };
};

let testTarget: NormalizedMongoTarget;
try {
  testTarget = normalizeMongoTarget(rawTestDatabaseUrl);
} catch {
  throw new Error('TEST_DATABASE_URL must be a valid, unambiguous MongoDB URI.');
}

const replicaSetValues = [...testTarget.relevantParameters.entries()]
  .filter(([name]) => name === 'replicaset')
  .map(([, value]) => value);
if (
  testTarget.databaseName !== 'todo_v6_integration' ||
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(rawTestDatabaseUrl).hostname.toLowerCase()) ||
  replicaSetValues.length !== 1 ||
  !replicaSetValues[0]?.trim()
) {
  throw new Error('TEST_DATABASE_URL must point to the exact local todo_v6_integration database and specify one replicaSet.');
}

const rawApplicationDatabaseUrl = process.env.DATABASE_URL;
if (!rawApplicationDatabaseUrl) {
  throw new Error('DATABASE_URL must be configured to verify integration database isolation.');
}

let applicationTarget: NormalizedMongoTarget;
try {
  applicationTarget = normalizeMongoTarget(rawApplicationDatabaseUrl);
} catch {
  throw new Error('DATABASE_URL must be a valid, unambiguous MongoDB URI for isolation verification.');
}

// Query options and credentials do not make the same host/port/database a
// separate database. For SRV/direct pairs the resolved port is not knowable
// without network access, so same-host/database comparisons fail closed.
const sameDatabaseEndpoint =
  testTarget.host === applicationTarget.host &&
  testTarget.databaseName === applicationTarget.databaseName &&
  (testTarget.protocol === 'mongodb+srv:' || applicationTarget.protocol === 'mongodb+srv:'
    ? true
    : testTarget.port === applicationTarget.port);

if (sameDatabaseEndpoint) {
  throw new Error('TEST_DATABASE_URL must not target the same MongoDB endpoint as DATABASE_URL.');
}

// The Prisma singleton reads DATABASE_URL when initialized. Set it only from
// the explicit integration URL after the independent target comparison.
process.env.DATABASE_URL = rawTestDatabaseUrl;
