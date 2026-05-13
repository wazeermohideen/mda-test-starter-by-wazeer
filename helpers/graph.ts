import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';

/**
 * Create an authenticated Microsoft Graph API client.
 *
 * Requires in .env:
 *   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
 *
 * The app registration needs Graph API permissions granted:
 *   Files.Read.All (SharePoint file access)
 *   Sites.Read.All (SharePoint site access)
 *   Mail.Read     (if checking emails)
 *
 * Usage:
 *   const graph = createGraphClient();
 *   const file  = await graph.api('/sites/{id}/drive/root:/report.docx').get();
 */
export function createGraphClient(): Client {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;

  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    throw new Error(
      'AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET are required in .env to use the Graph client.'
    );
  }

  const credential = new ClientSecretCredential(
    AZURE_TENANT_ID,
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  return Client.initWithMiddleware({ authProvider });
}

/**
 * Check whether a file exists at a SharePoint path.
 * Returns the file metadata if found, null if not found.
 *
 * Usage:
 *   const file = await getSharePointFile(graph, siteId, '/documents/report.docx');
 */
export async function getSharePointFile(
  client: Client,
  siteId: string,
  filePath: string
): Promise<Record<string, unknown> | null> {
  try {
    return await client
      .api(`/sites/${siteId}/drive/root:${filePath}`)
      .select('id,name,size,lastModifiedDateTime,webUrl')
      .get();
  } catch (err: any) {
    if (err?.statusCode === 404) return null;
    throw err;
  }
}

/**
 * Poll SharePoint until a file appears or the timeout is reached.
 * Useful for testing async document generation — the file may take a few seconds to appear.
 *
 * Usage:
 *   const file = await waitForSharePointFile(graph, siteId, '/documents/report.docx', 30_000);
 *   expect(file).not.toBeNull();
 */
export async function waitForSharePointFile(
  client: Client,
  siteId: string,
  filePath: string,
  timeoutMs = 30_000,
  intervalMs = 2_000
): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const file = await getSharePointFile(client, siteId, filePath);
    if (file) return file;
    await new Promise(r => setTimeout(r, intervalMs));
  }

  return null;
}

/**
 * Get the permissions on a SharePoint file.
 * Returns an array of permission objects showing who has access and what role.
 *
 * Usage:
 *   const perms = await getFilePermissions(graph, siteId, fileId);
 */
export async function getFilePermissions(
  client: Client,
  siteId: string,
  fileId: string
): Promise<Record<string, unknown>[]> {
  const result = await client
    .api(`/sites/${siteId}/drive/items/${fileId}/permissions`)
    .get();
  return result.value ?? [];
}
