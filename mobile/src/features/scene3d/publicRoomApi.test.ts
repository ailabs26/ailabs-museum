import { publicRoomApi } from './publicRoomApi';

describe('publicRoomApi', () => {
  const id = '10000000-0000-4000-8000-000000000001';

  afterEach(() => jest.restoreAllMocks());

  it('đọc đúng phòng theo slug và từ chối phản hồi phòng khác', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => ({
      ok: true,
      json: async () => ({ success: true, data: {
        id, slug: 'phong-khac', name: 'Phòng khác', description: null, exhibits: [],
      } }),
    }) as Response);

    await expect(publicRoomApi.detail('phong-chon')).rejects.toThrow('sai phòng');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/rooms/phong-chon'), expect.any(Object));
  });

  it('chặn hiện vật có roomId khác phòng đang mở', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => ({
      ok: true,
      json: async () => ({ success: true, data: {
        id, slug: 'phong-chon', name: 'Phòng chọn', description: null,
        exhibits: [{
          id: '20000000-0000-4000-8000-000000000002',
          roomId: '30000000-0000-4000-8000-000000000003',
          displayOrder: 0, name: 'Sai phòng', description: '',
          placeholderShape: 'box', placeholderColor: '#ffffff', model: null,
        }],
      } }),
    }) as Response);

    await expect(publicRoomApi.detail('phong-chon')).rejects.toThrow('không hợp lệ');
  });
});
