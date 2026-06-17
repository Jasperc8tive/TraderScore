/**
 * Secrets abstraction.
 *
 * Application code asks a SecretProvider for a secret by name and never reads
 * secret material directly from the environment. Today the only implementation
 * is env-backed (local-first). In a future infrastructure stage an
 * AwsSecretsManagerProvider can be dropped in with no application changes —
 * satisfying the cloud-ready mandate (spec §15).
 */

export interface SecretProvider {
  /** Resolve a secret value, or undefined if not set. */
  get(name: string): Promise<string | undefined>;
  /** Resolve a required secret, throwing if it is absent. */
  getRequired(name: string): Promise<string>;
}

/** Reads secrets from the process environment. */
export class EnvSecretProvider implements SecretProvider {
  constructor(private readonly source: NodeJS.ProcessEnv = process.env) {}

  async get(name: string): Promise<string | undefined> {
    return this.source[name];
  }

  async getRequired(name: string): Promise<string> {
    const value = this.source[name];
    if (value === undefined || value === "") {
      throw new Error(`Required secret "${name}" is not set`);
    }
    return value;
  }
}

let provider: SecretProvider = new EnvSecretProvider();

/** Override the global secret provider (e.g. in tests or future cloud setup). */
export function setSecretProvider(next: SecretProvider): void {
  provider = next;
}

export function getSecretProvider(): SecretProvider {
  return provider;
}
