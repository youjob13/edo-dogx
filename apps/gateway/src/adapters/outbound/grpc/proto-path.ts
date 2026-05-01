import fs from 'node:fs';
import path from 'node:path';

export function resolveServiceProtoPath(): string {
  const envPath = process.env['SERVICE_PROTO_PATH'];
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const candidates = [
    path.resolve(process.cwd(), 'shared/proto/service.proto'),
    path.resolve(process.cwd(), '../../shared/proto/service.proto'),
    path.resolve(__dirname, '../../../../shared/proto/service.proto'),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (found) {
    return found;
  }

  throw new Error(
    `Unable to locate shared/proto/service.proto. Checked: ${candidates.join(', ')}. ` +
      'Set SERVICE_PROTO_PATH to an absolute path if needed.',
  );
}
