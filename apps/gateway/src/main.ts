// BFF Gateway — entry point
// Wires up the Fastify server, registers plugins and route adapters.

async function main(): Promise<void> {
  // TODO: bootstrap application
  //   1. Load config from environment
  //   2. Create Fastify instance
  //   3. Register session plugin (Redis-backed)
  //   4. Register Keycloak auth plugin
  //   5. Register inbound HTTP adapters (routes)
  //   6. Start listening
  console.log('Gateway starting on port', process.env['PORT'] ?? 3000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
