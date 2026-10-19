/** Paths and SHA-256 verified by downloading all five private objects on 2026-10-15. */
export const STORAGE_MODEL_ROOM = { id: '74b719c0-4828-49d1-bb7b-000000000000', slug: 'bo-suu-tap-glb' };
export const STORAGE_MODELS = [
  { key: 'models/trong_dong_dong_son.glb', name: 'Trống đồng Đông Sơn', size: 16529444, checksum: 'd3d16b016076cbeb82af75dc65302ebb511ce8ff6c28c7d45e9de7d5ac75d690', position: { x: -4, y: 0, z: -3.7 } },
  { key: 'models/binh_rot_men_ngoc.glb', name: 'Bình rót men ngọc', size: 22282920, checksum: '8ea0624b82e7a6f1c61866b9ac96b367df9aba0381a20520ee0477e584b34d16', position: { x: 0, y: 0, z: -3.7 } },
  { key: 'models/coc_go_bach_dang.glb', name: 'Cọc gỗ Bạch Đằng', size: 3562172, checksum: '1677adf9ec5e6e6aed8226f8488788ce9a7f283afb1773e40a997c1ab897e182', position: { x: 4, y: 0, z: -3.7 } },
  { key: 'models/tuong_than_shiva_champa.glb', name: 'Tượng thần Shiva Chăm Pa', size: 28901752, checksum: '2d2e987dbd1c65a8e1af97b0aa109a3784faa5cbf4710d124421bfcc65968533', position: { x: -4.3, y: 0, z: 1.2 } },
  { key: 'models/tuong_vua_champa.glb', name: 'Tượng vua Chăm Pa', size: 18291744, checksum: 'dc8644536ae6f70727fdc8f55e939a5b85c0c8ae6454d882120ceb6a9920c64f', position: { x: 4.3, y: 0, z: 1.2 } },
].map((model, index) => ({ ...model, mediaId: `74b719c0-4828-49d1-bb7b-00000010000${index + 1}`,
  exhibitId: `74b719c0-4828-49d1-bb7b-00000020000${index + 1}`, revisionId: `74b719c0-4828-49d1-bb7b-00000030000${index + 1}` }));
