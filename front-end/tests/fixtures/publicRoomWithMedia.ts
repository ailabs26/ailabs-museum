// Real GET /api/rooms/:slug response captured from the Task 9 E2E run (production build + PostgreSQL).
// Test input only; never a production fallback. The `model` block follows the GLB tour contract
// adopted when merging dev (stable /rooms/.../model route); its checksum is a placeholder.
export const publicRoomWithMediaResponse = {
  "success": true,
  "data": {
    "id": "a39b8304-8df3-426d-80bd-6f5c96a6875f",
    "slug": "e2e-1792074612",
    "name": "Phòng E2E",
    "description": null,
    "exhibits": [
      {
        "id": "ddc811c8-4c00-48b4-915a-8cdcbb70f836",
        "roomId": "a39b8304-8df3-426d-80bd-6f5c96a6875f",
        "displayOrder": 0,
        "name": "Bình gốm",
        "description": "Mô tả",
        "transcript": "Thuyết minh",
        "i18n": {
          "vi": {
            "name": "Bình gốm",
            "description": "Mô tả",
            "transcript": "Thuyết minh"
          },
          "en": {
            "name": "Ceramic vase",
            "description": "Description",
            "transcript": "Narration"
          }
        },
        "positionX": 0,
        "positionY": 0,
        "positionZ": 0,
        "rotation": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "scale": {
          "x": 1,
          "y": 1,
          "z": 1
        },
        "placeholderShape": "box",
        "placeholderColor": "#8b7355",
        "hotspots": [
          {
            "id": "fb8f29c2-c65c-4a64-a51a-ad91f0e83b24",
            "label": "Miệng bình",
            "body": "Chi tiết",
            "i18n": {
              "vi": {
                "label": "Miệng bình",
                "body": "Chi tiết"
              },
              "en": {
                "label": "Rim",
                "body": "Detail"
              }
            },
            "positionX": 0.1,
            "positionY": 0.2,
            "positionZ": 0.3,
            "displayOrder": 0
          }
        ],
        "model": {
          "id": "29e7e617-b4d0-48d9-8808-b6db610f1adb",
          "storageKey": "uploads/models/fb9a8de2-db16-4f9c-b658-7fee6aca765c.glb",
          "sizeBytes": 320,
          "checksumSha256": "3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f",
          "url": "/rooms/e2e-1792074612/exhibits/ddc811c8-4c00-48b4-915a-8cdcbb70f836/model?version=3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f"
        },
        "image": {
          "id": "cc0a5605-c484-4229-a29e-55e7e46e99ad",
          "url": "http://localhost:3911/media/uploads/images/b5aad10f-c509-4069-bcb4-fd287f06f2b4.png",
          "mimeType": "image/png",
          "sizeBytes": 71,
          "rights": {
            "source": "Bảo tàng Aura",
            "author": "Nhóm E2E",
            "license": "CC BY 4.0"
          },
          "altText": {
            "vi": "Ảnh bình",
            "en": "Vase photo"
          }
        },
        "audio": {
          "vi": {
            "audio": {
              "id": "a93468fd-0be2-4f85-a684-65d1415a8825",
              "url": "http://localhost:3911/media/uploads/audio/98d6467e-b74b-44a2-83e1-ba3fa4d40ebf.mp3",
              "mimeType": "audio/mpeg",
              "sizeBytes": 2532,
              "rights": {
                "source": "Bảo tàng Aura",
                "author": "Nhóm E2E",
                "license": "CC BY 4.0"
              }
            },
            "subtitle": {
              "id": "4c3aedcf-f968-45c8-9e6e-4779f811cabe",
              "url": "http://localhost:3911/media/uploads/subtitles/bc56c2b6-43bd-4a40-9030-ede6dee21ab2.vtt",
              "mimeType": "text/vtt",
              "sizeBytes": 156,
              "rights": {
                "source": "Bảo tàng Aura",
                "author": "Nhóm E2E",
                "license": "CC BY 4.0"
              }
            },
            "transcript": "Thuyết minh"
          },
          "en": {
            "audio": {
              "id": "0b818657-08ce-4ed9-af82-10abe6d261eb",
              "url": "http://localhost:3911/media/uploads/audio/3d6c8cb8-e728-42e4-b982-127a6ee46ad6.mp3",
              "mimeType": "audio/mpeg",
              "sizeBytes": 2532,
              "rights": {
                "source": "Bảo tàng Aura",
                "author": "Nhóm E2E",
                "license": "CC BY 4.0"
              }
            },
            "subtitle": {
              "id": "ce669127-183e-40c2-bb31-7a51636237ce",
              "url": "http://localhost:3911/media/uploads/subtitles/d4faebe3-3efc-43ee-9f2d-373bce0703a4.vtt",
              "mimeType": "text/vtt",
              "sizeBytes": 156,
              "rights": {
                "source": "Bảo tàng Aura",
                "author": "Nhóm E2E",
                "license": "CC BY 4.0"
              }
            },
            "transcript": "Narration"
          }
        }
      }
    ]
  },
  "message": null
};
