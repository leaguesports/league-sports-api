import {
  DEFAULT_OPENF1_BASE_URL,
  DEFAULT_OPENF1_CACHE_TTL_MS,
} from "../config";
import { Meeting } from "../entities/meeting";
import { OpenF1UnavailableError } from "../entities/openf1-unavailable-error";
import { Session } from "../entities/session";
import {
  OpenF1Client,
  OpenF1MeetingFilters,
  OpenF1SessionFilters,
} from "./openf1-client";

export type HttpOpenF1ClientOptions = {
  baseUrl?: string;
  apiKey?: string;
  cacheTtlMs?: number;
  fetchImpl?: typeof fetch;
};

type CacheEntry = {
  expiresAt: number;
  body: unknown;
};

export class HttpOpenF1Client implements OpenF1Client {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly cacheTtlMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: HttpOpenF1ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_OPENF1_BASE_URL).replace(
      /\/$/,
      "",
    );
    this.apiKey = options.apiKey?.trim() || undefined;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_OPENF1_CACHE_TTL_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async listMeetings(filters: OpenF1MeetingFilters = {}): Promise<Meeting[]> {
    const payload = await this.getJson("/meetings", {
      year: filters.year,
      country_name: filters.countryName,
      country_code: filters.countryCode,
      meeting_name: filters.meetingName,
      location: filters.location,
      circuit_short_name: filters.circuitShortName,
      meeting_key: filters.meetingKey?.toQueryValue(),
    });

    return asArray(payload).map((row) => Meeting.fromApi(row));
  }

  async listSessions(filters: OpenF1SessionFilters = {}): Promise<Session[]> {
    const payload = await this.getJson("/sessions", {
      year: filters.year,
      country_name: filters.countryName,
      country_code: filters.countryCode,
      location: filters.location,
      circuit_short_name: filters.circuitShortName,
      meeting_key: filters.meetingKey?.toQueryValue(),
      session_key: filters.sessionKey?.toQueryValue(),
      session_name: filters.sessionName,
      session_type: filters.sessionType,
    });

    return asArray(payload).map((row) => Session.fromApi(row));
  }

  private async getJson(
    path: string,
    params: Record<string, string | number | undefined>,
  ): Promise<unknown> {
    const url = this.buildUrl(path, params);
    const cached = this.readCache(url);
    if (cached !== undefined) {
      return cached;
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, { headers });
    } catch (error) {
      throw new OpenF1UnavailableError("OpenF1 is unavailable", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new OpenF1UnavailableError(
        `OpenF1 returned ${response.status}`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new OpenF1UnavailableError("OpenF1 returned an invalid payload", {
        cause: error,
      });
    }

    this.writeCache(url, body);
    return body;
  }

  private buildUrl(
    path: string,
    params: Record<string, string | number | undefined>,
  ): string {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private readCache(key: string): unknown | undefined {
    if (this.cacheTtlMs <= 0) {
      return undefined;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.body;
  }

  private writeCache(key: string, body: unknown): void {
    if (this.cacheTtlMs <= 0) {
      return;
    }
    this.cache.set(key, {
      expiresAt: Date.now() + this.cacheTtlMs,
      body,
    });
  }
}

function asArray(payload: unknown): unknown[] {
  if (!Array.isArray(payload)) {
    throw new OpenF1UnavailableError("OpenF1 returned an invalid payload");
  }
  return payload;
}
