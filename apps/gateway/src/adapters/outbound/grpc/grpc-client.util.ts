import {
  Client,
  credentials,
  loadPackageDefinition,
  type GrpcObject,
  type ServiceClientConstructor,
  type ServiceError,
} from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';

type GrpcMethod = (request: unknown, callback: (err: ServiceError | null, response: unknown) => void) => void;

function isGrpcObject(value: unknown): value is GrpcObject {
  return typeof value === 'object' && value !== null;
}

function isServiceCtor(value: unknown): value is ServiceClientConstructor {
  return typeof value === 'function';
}

function toGrpcMethod(owner: object, value: unknown): GrpcMethod | undefined {
  if (typeof value !== 'function') {
    return undefined;
  }

  return (request, callback) => {
    Reflect.apply(value, owner, [request, callback]);
  };
}

export function createGrpcClient(serviceName: string, address: string, protoPath: string): Client {
  const packageDefinition = loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const pkg = loadPackageDefinition(packageDefinition);
  const serviceNamespace = isGrpcObject(pkg) ? pkg['service'] : undefined;
  const versionNamespace = isGrpcObject(serviceNamespace) ? serviceNamespace['v1'] : undefined;
  const ctor = isGrpcObject(versionNamespace) ? versionNamespace[serviceName] : undefined;

  if (!isServiceCtor(ctor)) {
    throw new Error(`gRPC service constructor is not available: service.v1.${serviceName}`);
  }

  return new ctor(address, credentials.createInsecure());
}

export function resolveUnaryMethod(client: Client, methodName: string): GrpcMethod | undefined {
  const preferred = toGrpcMethod(client, Reflect.get(client, methodName));
  if (preferred) {
    return preferred;
  }

  const lowerCamel = methodName.charAt(0).toLowerCase() + methodName.slice(1);
  return toGrpcMethod(client, Reflect.get(client, lowerCamel));
}

export function callUnary(client: Client, methodName: string, payload: unknown): Promise<unknown> {
  const method = resolveUnaryMethod(client, methodName);
  if (!method) {
    return Promise.reject(new Error(`RPC method is not available on client: ${methodName}`));
  }

  return new Promise((resolve, reject) => {
    method(payload, (err, response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(response);
    });
  });
}
