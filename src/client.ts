import { request as httpsRequest } from "node:https";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API_BASE_URL = "https://api2.wfirma.pl";
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

export interface WfirmaCredentials {
  accessKey: string;
  secretKey: string;
  appKey: string;
}

export interface WfirmaRequestInput {
  module: string;
  action: "find" | "get";
  id?: string;
  companyId?: string;
  body?: unknown;
}

export interface RawRequestInput {
  url: URL;
  headers: Record<string, string>;
  body?: string;
}

export type RawRequest = (input: RawRequestInput) => Promise<{
  statusCode: number;
  body: string;
}>;

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`wfirma_credential_missing:${name}`);
  return value;
}

export function loadWfirmaCredentials(
  env: Record<string, string | undefined>,
): WfirmaCredentials {
  return {
    accessKey: required(env, "WFIRMA_ACCESS_KEY"),
    secretKey: required(env, "WFIRMA_SECRET_KEY"),
    appKey: required(env, "WFIRMA_APP_KEY"),
  };
}

function assertIdentifier(value: string, label: string): void {
  if (!/^[0-9]+$/.test(value)) throw new Error(`wfirma_${label}_invalid`);
}

export const requestWfirmaRaw: RawRequest = ({ url, headers, body }) =>
  new Promise((resolve, reject) => {
    const request = httpsRequest(url, {
      method: "GET",
      headers: {
        ...headers,
        ...(body ? { "Content-Length": Buffer.byteLength(body).toString() } : {}),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      let received = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        received += buffer.length;
        if (received > MAX_RESPONSE_BYTES) {
          request.destroy(new Error("wfirma_response_too_large"));
          return;
        }
        chunks.push(buffer);
      });
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    request.setTimeout(20_000, () => request.destroy(new Error("wfirma_request_timeout")));
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function unwrapApi(value: unknown): Record<string, unknown> {
  const root = recordOf(value);
  if (!root) throw new Error("wfirma_response_invalid");
  return recordOf(root.api) ?? root;
}

function statusCodeOf(payload: Record<string, unknown>): string {
  const status = recordOf(payload.status);
  return typeof status?.code === "string" ? status.code.trim().toUpperCase() : "";
}

export async function wfirmaRequest(
  credentials: WfirmaCredentials,
  input: WfirmaRequestInput,
  rawRequest: RawRequest = requestWfirmaRaw,
): Promise<Record<string, unknown>> {
  if (input.companyId) assertIdentifier(input.companyId, "company_id");
  if (input.id) assertIdentifier(input.id, "record_id");

  const suffix = input.id ? `/${encodeURIComponent(input.id)}` : "";
  const url = new URL(`/${input.module}/${input.action}${suffix}`, API_BASE_URL);
  url.searchParams.set("inputFormat", "json");
  url.searchParams.set("outputFormat", "json");
  if (input.companyId) url.searchParams.set("company_id", input.companyId);
  const body = input.body === undefined ? undefined : JSON.stringify(input.body);
  const response = await rawRequest({
    url,
    headers: {
      accessKey: credentials.accessKey,
      secretKey: credentials.secretKey,
      appKey: credentials.appKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body,
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`wfirma_http_${response.statusCode}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body) as unknown;
  } catch {
    if (/^(AUTH|ACCESS DENIED|AUTH FAILED LIMIT WAIT 5 MINUTES)$/i.test(response.body.trim())) {
      throw new Error("wfirma_api_AUTH");
    }
    throw new Error("wfirma_response_invalid");
  }
  if (typeof parsed === "string" && /^(AUTH|ACCESS DENIED|AUTH FAILED LIMIT WAIT 5 MINUTES)$/i.test(parsed.trim())) {
    throw new Error("wfirma_api_AUTH");
  }
  const payload = unwrapApi(parsed);
  const statusCode = statusCodeOf(payload);
  if (statusCode !== "OK") {
    throw new Error(`wfirma_api_${statusCode || "ERROR"}`);
  }
  return payload;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value === "string" || typeof value === "number") return String(value);
  return undefined;
}

export interface WfirmaCompany {
  id: string;
  name?: string;
  altname?: string;
  nip?: string;
}

export function extractWfirmaCompanies(payload: Record<string, unknown>): WfirmaCompany[] {
  const companies = new Map<string, WfirmaCompany>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = recordOf(value);
    if (!record) return;
    // Some API shapes expose a user-company relation record as well as the
    // company record. Prefer the explicit company_* fields so a relation id is
    // never mistaken for the company id used by ?company_id=.
    const id = stringField(record, "company_id") ?? stringField(record, "id");
    const name = stringField(record, "company_name") ?? stringField(record, "name");
    const altname = stringField(record, "company_altname") ?? stringField(record, "altname");
    const nip = stringField(record, "company_nip") ?? stringField(record, "nip");
    if (id && /^[0-9]+$/.test(id) && (name || altname || nip)) {
      companies.set(id, {
        id,
        ...(name ? { name } : {}),
        ...(altname ? { altname } : {}),
        ...(nip ? { nip } : {}),
      });
    }
    Object.values(record).forEach(visit);
  };
  visit(payload.user_companies);
  return [...companies.values()];
}

export async function saveWfirmaPortfolio(
  filePath: string | undefined,
  companies: WfirmaCompany[],
): Promise<void> {
  if (!filePath) return;
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await writeFile(filePath, JSON.stringify({
    updatedAt: new Date().toISOString(),
    companies,
  }, null, 2), { encoding: "utf8", mode: 0o600 });
}
