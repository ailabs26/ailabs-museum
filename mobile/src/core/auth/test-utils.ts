import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { http } from '@/core/api/http-client';

/** Phản hồi giả: status + data (data sẽ được bọc envelope ApiResponse). */
export type FakeReply = { status: number; data?: unknown } | 'network-error';
export type FakeRoute = (config: InternalAxiosRequestConfig) => FakeReply;

const envelope = (status: number, data: unknown) =>
  status < 400
    ? { success: true, data: data ?? null, message: null }
    : { success: false, data: null, message: typeof data === 'string' ? data : `HTTP ${status}` };

/**
 * Cắm adapter giả vào http-client; `route` quyết định phản hồi theo request.
 * Trả danh sách request đã gửi (url, header Authorization/X-Client, body) để kiểm.
 */
export function installFakeApi(route: FakeRoute) {
  const sent: { url: string; authorization?: string; client?: string; body?: unknown }[] = [];
  const adapter: AxiosAdapter = async (config) => {
    sent.push({
      url: config.url ?? '',
      authorization: config.headers.Authorization as string | undefined,
      client: config.headers['X-Client'] as string | undefined,
      body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
    });
    const reply = route(config);
    if (reply === 'network-error') throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    const response = { status: reply.status, statusText: '', data: envelope(reply.status, reply.data), headers: {}, config };
    if (reply.status >= 400) {
      throw new AxiosError(`HTTP ${reply.status}`, AxiosError.ERR_BAD_RESPONSE, config, null, response);
    }
    return response;
  };
  http.raw.defaults.adapter = adapter;
  return sent;
}

export const USER = {
  id: '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  email: 'visitor@aura.local',
  displayName: 'Khách',
  roles: ['visitor'],
  permissions: [],
};
