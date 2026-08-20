import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';

/**
 * Lightweight Dataverse REST API client for seeding and cleaning up test data.
 *
 * Auth: uses AZURE_CLIENT_ID + AZURE_CLIENT_SECRET + AZURE_TENANT_ID from .env.
 * Falls back to DefaultAzureCredential (managed identity, CLI login) if not set.
 *
 * Usage:
 *   const db = new DataverseClient();
 *   const record = await db.create('cr123_equipments', { cr123_name: 'Test Unit' });
 *   console.log(record.cr123_equipmentid); // the new GUID
 *   await db.delete('cr123_equipments', record.cr123_equipmentid);
 */
export class DataverseClient {
  private readonly baseUrl: string;
  private readonly scope: string;
  private readonly credential: ClientSecretCredential | DefaultAzureCredential;

  constructor() {
    // Derive the org root URL from the MDA URL env var
    const orgUrl = (
      process.env.DATAVERSE_URL ??
      process.env.MODEL_DRIVEN_APP_URL?.split('/main.aspx')[0]
    );

    if (!orgUrl) {
      throw new Error(
        'Set DATAVERSE_URL or MODEL_DRIVEN_APP_URL in .env so DataverseClient can resolve the API endpoint.'
      );
    }

    this.baseUrl = `${orgUrl}/api/data/v9.2`;
    this.scope   = `${orgUrl}/.default`;

    const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;

    this.credential =
      AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET
        ? new ClientSecretCredential(AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)
        : new DefaultAzureCredential();
  }

  private async token(): Promise<string> {
    const result = await this.credential.getToken(this.scope);
    return result.token;
  }

  private async fetch<T>(method: string, path: string, body?: object): Promise<T> {
    const res = await globalThis.fetch(`${this.baseUrl}/${path}`, {
      method,
      headers: {
        Authorization:    `Bearer ${await this.token()}`,
        'OData-MaxVersion': '4.0',
        'OData-Version':    '4.0',
        'Content-Type':     'application/json',
        Prefer:             'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Dataverse ${method} ${path} → ${res.status}: ${text}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  /** Create a record. Returns the full created record including its GUID. */
  async create(entityPluralName: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.fetch('POST', entityPluralName, data);
  }

  /** Read a single record by GUID. */
  async read(entityPluralName: string, id: string, select?: string[]): Promise<Record<string, unknown>> {
    const qs = select?.length ? `?$select=${select.join(',')}` : '';
    return this.fetch('GET', `${entityPluralName}(${id})${qs}`);
  }

  /** Update a record by GUID (PATCH — only fields you provide are changed). */
  async update(entityPluralName: string, id: string, data: Record<string, unknown>): Promise<void> {
    await this.fetch('PATCH', `${entityPluralName}(${id})`, data);
  }

  /** Delete a record by GUID. */
  async delete(entityPluralName: string, id: string): Promise<void> {
    const res = await globalThis.fetch(`${this.baseUrl}/${entityPluralName}(${id})`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${await this.token()}` },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Dataverse DELETE ${entityPluralName}(${id}) → ${res.status}`);
    }
  }

  /** Query records with OData filter/select/top. */
  async query(
    entityPluralName: string,
    options: { filter?: string; select?: string[]; top?: number; orderBy?: string[] } = {}
  ): Promise<Record<string, unknown>[]> {
    const params = new URLSearchParams();
    if (options.filter) params.set('$filter', options.filter);
    if (options.select?.length) params.set('$select', options.select.join(','));
    if (options.top) params.set('$top', String(options.top));
    if (options.orderBy?.length) params.set('$orderby', options.orderBy.join(','));

    const qs = params.toString() ? `?${params}` : '';
    const result = await this.fetch<{ value: Record<string, unknown>[] }>('GET', `${entityPluralName}${qs}`);
    return result.value;
  }
}
