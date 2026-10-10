# Task T-ROOMS (Task 6): RoomsModule — Quản lý Phòng trưng bày

**Phụ trách:** Nguyễn Trọng Thành (Fullstack / CMS Frontend & QA Lead)  
**Thời gian:** 11/10/2026 – 14/10/2026 (Phase 1 — MVP)  
**Nhánh:** `feat/be-rooms-crud` (rẽ từ `dev`)  
**Tài liệu liên quan:**
- Đặc tả yêu cầu: [`../requirements.md`](../requirements.md) (FR-48, FR-50, FR-51, FR-52, BR-19, BR-20)
- Kiến trúc Backend: [`../architecture/02-backend-architecture.md`](../architecture/02-backend-architecture.md)
- Mô hình dữ liệu ERD: [`../architecture/04-data-model-erd.md`](../architecture/04-data-model-erd.md)
- Bảo mật & Phân quyền: [`../architecture/05-security-rbac.md`](../architecture/05-security-rbac.md)
- Hợp đồng API: [`../architecture/06-api-contract.md`](../architecture/06-api-contract.md)
- Kế hoạch chi tiết V1: [`../../back-end/docs/plans/v1/task-06-rooms-crud.md`](../../back-end/docs/plans/v1/task-06-rooms-crud.md)

---

## 1. Bối cảnh kiến trúc hiện tại (Current Architectural Context)

Hệ thống Backend NestJS của dự án đã được hoàn thiện tầng nền tảng (Foundation) với các module sau:

1. **Tầng Core (`back-end/src/core/`):**
   - `BaseRepository<T>`: Adapter triển khai sẵn các hàm `findById`, `findOne`, `findMany`, `paginate`, `create`, `save`, `update`, `softDelete`, `remove`. **Service tuyệt đối không gọi trực tiếp TypeORM `Repository<T>` mà phải thông qua `RoomsRepository`**.
   - `ApiResponse<T>` & `ResponseInterceptor`: Mọi giá trị trả về từ Controller tự động được bọc vào envelope `{ success: true, data: T, message: null, meta?: { page, pageSize, total } }`.
   - `AllExceptionsFilter`: Bắt toàn bộ lỗi và chuẩn hóa thành `{ success: false, message: string, errors?: [...] }`.
     - `NotFoundException` $\rightarrow$ HTTP 404
     - `ConflictException` (hoặc `BusinessException`) $\rightarrow$ HTTP 409
     - `BadRequestException` / `ValidationException` $\rightarrow$ HTTP 422 / 400

2. **Tầng Auth & Phân quyền RBAC (`back-end/src/core/auth/`):**
   - `JwtAuthGuard` đã được kích hoạt toàn cục trong `AppModule`. Mọi route mặc định **đều yêu cầu Bearer JWT Token**.
   - Phân quyền theo action bằng decorator `@Permissions(...)` kết hợp `PermissionsGuard`.
   - Lấy thông tin user đăng nhập hiện tại bằng `@CurrentUser() user: AuthUser`.

3. **Mã quyền đã định nghĩa sẵn (`back-end/src/common/constants/permissions.constant.ts`):**
   ```typescript
   PERMISSIONS.ROOM_READ   = 'room:read';    // Xem danh sách và chi tiết phòng
   PERMISSIONS.ROOM_CREATE = 'room:create';  // Tạo phòng trưng bày mới
   PERMISSIONS.ROOM_UPDATE = 'room:update';  // Chỉnh sửa thông tin phòng
   PERMISSIONS.ROOM_DELETE = 'room:delete';  // Xóa / Lưu trữ phòng
   ```

---

## 2. Context Cơ sở dữ liệu & Entity `Room`

Entity `Room` đã được cập nhật hoàn chỉnh trong [`back-end/src/rooms/room.entity.ts`](../../back-end/src/rooms/room.entity.ts) với migration `AlignMuseumMvpSchema`:

```typescript
@Entity('rooms')
@Check('CHK_rooms_status', '"status" IN (\'active\', \'archived\')')
@Check('CHK_rooms_deleted', '"is_deleted" = ("deleted_at" IS NOT NULL)')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 12, default: RoomStatus.ACTIVE })
  status!: RoomStatus; // 'active' | 'archived'

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => Exhibit, (exhibit) => exhibit.room)
  exhibits!: Exhibit[];
}
```

### Lưu ý quan trọng về dữ liệu:
- **Xóa mềm (Soft-delete):** Hệ thống dùng cờ `isDeleted = true` và `deletedAt = new Date()`.
- **Ràng buộc Check Constraint:** `is_deleted` bắt buộc phải khớp logic với `deleted_at IS NOT NULL`.
- **Slug Unique:** Không được phép trùng `slug`. Chỉ cho phép chữ thường `a-z`, số `0-9` và dấu gạch ngang `-`.

---

## 3. Cấu trúc thư mục cần triển khai (`back-end/src/rooms/`)

```text
back-end/src/rooms/
├── room.entity.ts                    # Đã có sẵn — không sửa
├── rooms.module.ts                   # Khai báo module, controllers, providers, exports
├── rooms.controller.ts               # Admin API endpoints có @Permissions()
├── rooms.service.ts                  # Nghiệp vụ xử lý (CRUD, validate slug, check relation)
├── repositories/
│   └── rooms.repository.ts           # Kế thừa BaseRepository<Room>, truy vấn đặc thù
└── dto/
    ├── create-room.dto.ts            # DTO tạo phòng mới
    ├── update-room.dto.ts            # DTO cập nhật phòng
    ├── list-rooms-query.dto.ts       # DTO phân trang & tìm kiếm
    └── room-response.dto.ts          # DTO chuẩn hóa dữ liệu trả về cho client
```

---

## 4. Đặc tả hợp đồng API (API Contract)

Toàn bộ endpoint Admin nằm dưới đường dẫn: `/api/admin/rooms`.

### 4.1 Danh sách phòng (có phân trang & tìm kiếm)
* **Method & Path:** `GET /api/admin/rooms`
* **Quyền yêu cầu:** `@Permissions('room:read')`
* **Query Params:**
  * `page` (number, default: 1)
  * `pageSize` (number, default: 20, max: 100)
  * `q` (string, optional — tìm kiếm theo `name` hoặc `slug`)
  * `status` (enum, optional: `active` | `archived`)
* **Response (Envelope):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "e4b50c18-971c-4b68-b39f-f5cf171a8123",
        "slug": "phong-kham-pha",
        "name": "Phòng Khám Phá",
        "description": "Không gian trưng bày chính",
        "status": "active",
        "exhibitsCount": 5,
        "createdAt": "2026-10-10T10:00:00Z",
        "updatedAt": "2026-10-10T10:00:00Z"
      }
    ],
    "message": null,
    "meta": { "page": 1, "pageSize": 20, "total": 1 }
  }
  ```

### 4.2 Chi tiết 1 phòng
* **Method & Path:** `GET /api/admin/rooms/:id`
* **Quyền yêu cầu:** `@Permissions('room:read')`
* **Lỗi:** 404 nếu không tìm thấy hoặc đã bị soft-deleted.

### 4.3 Tạo phòng mới
* **Method & Path:** `POST /api/admin/rooms`
* **Quyền yêu cầu:** `@Permissions('room:create')`
* **Request Body:**
  ```json
  {
    "slug": "phong-my-thuat-hien-dai",
    "name": "Phòng Mỹ Thuật Hiện Đại",
    "description": "Trưng bày các tác phẩm thế kỷ 20"
  }
  ```
* **Validation:**
  * `slug`: Bắt buộc, chuỗi 1–120 ký tự, regex `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`. Trùng slug $\rightarrow$ `409 Conflict`.
  * `name`: Bắt buộc, chuỗi 1–200 ký tự không được là khoảng trắng rỗng sau khi trim.
  * `description`: Tùy chọn, chuỗi text.
* **Response:** HTTP 201 Created kèm dữ liệu phòng vừa tạo.

### 4.4 Cập nhật phòng
* **Method & Path:** `PATCH /api/admin/rooms/:id`
* **Quyền yêu cầu:** `@Permissions('room:update')`
* **Request Body:** Cho phép cập nhật `name`, `description`, `status` (`active`/`archived`).
* **Lưu ý:** Không cho phép đổi `slug` để bảo toàn permalink URL và tính nhất quán với Client.

### 4.5 Xóa phòng
* **Method & Path:** `DELETE /api/admin/rooms/:id`
* **Quyền yêu cầu:** `@Permissions('room:delete')`
* **Quy tắc nghiệp vụ xóa (BR-20):**
  * Kiểm tra xem phòng có hiện vật nào đang ở trạng thái `published` không.
  * Nếu phòng **đang chứa hiện vật đã xuất bản** $\rightarrow$ **Từ chối xóa, ném `ConflictException` (409)** với thông báo: *"Không thể xóa phòng đang có hiện vật đã xuất bản. Vui lòng chuyển hoặc gỡ xuất bản các hiện vật trước."*
  * Nếu phòng rỗng hoặc chỉ chứa hiện vật nháp $\rightarrow$ Thực hiện **Soft-delete**: cập nhật `isDeleted = true`, `deletedAt = new Date()`. Trả về `{ success: true, message: "Xóa phòng thành công" }`.

---

## 5. Blueprint mã nguồn chi tiết (Ready-to-Code)

### 5.1 `dto/create-room.dto.ts`
```typescript
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ example: 'phong-kham-pha', description: 'Định danh slug duy nhất' })
  @IsString()
  @IsNotEmpty({ message: 'Slug không được để trống' })
  @MaxLength(120, { message: 'Slug không được vượt quá 120 ký tự' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ được chứa chữ thường không dấu, số và gạch ngang (kebab-case)',
  })
  slug!: string;

  @ApiProperty({ example: 'Phòng Khám Phá', description: 'Tên phòng trưng bày' })
  @IsString()
  @IsNotEmpty({ message: 'Tên phòng không được để trống' })
  @MaxLength(200, { message: 'Tên phòng không được vượt quá 200 ký tự' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @ApiPropertyOptional({ example: 'Mô tả chi tiết phòng', description: 'Mô tả phòng' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;
}
```

### 5.2 `dto/update-room.dto.ts`
```typescript
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus } from '../room.entity';

export class UpdateRoomDto {
  @ApiPropertyOptional({ example: 'Tên phòng mới' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên phòng không được rỗng' })
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ example: 'Mô tả cập nhật' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @ApiPropertyOptional({ enum: RoomStatus, example: RoomStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RoomStatus, { message: 'Trạng thái phòng không hợp lệ' })
  status?: RoomStatus;
}
```

### 5.3 `dto/list-rooms-query.dto.ts`
```typescript
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RoomStatus } from '../room.entity';

export class ListRoomsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên hoặc slug' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: RoomStatus, description: 'Lọc theo trạng thái' })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;
}
```

### 5.4 `repositories/rooms.repository.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { BaseRepository } from '../../core/repository/base.repository';
import { Room, RoomStatus } from '../room.entity';
import { ListRoomsQueryDto } from '../dto/list-rooms-query.dto';
import { Paginated } from '../../common/types/paginated.type';

@Injectable()
export class RoomsRepository extends BaseRepository<Room> {
  constructor(@InjectRepository(Room) repo: Repository<Room>) {
    super(repo);
  }

  async findBySlug(slug: string): Promise<Room | null> {
    return this.findOne({ slug, isDeleted: false });
  }

  async searchRooms(query: ListRoomsQueryDto): Promise<Paginated<Room>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb: SelectQueryBuilder<Room> = this.repo
      .createQueryBuilder('room')
      .where('room.isDeleted = :isDeleted', { isDeleted: false });

    if (query.status) {
      qb.andWhere('room.status = :status', { status: query.status });
    }

    if (query.q) {
      qb.andWhere('(room.name ILIKE :search OR room.slug ILIKE :search)', {
        search: `%${query.q.trim()}%`,
      });
    }

    qb.orderBy('room.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }
}
```

### 5.5 `rooms.service.ts`
```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RoomsRepository } from './repositories/rooms.repository';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { ListRoomsQueryDto } from './dto/list-rooms-query.dto';
import { RoomResponseDto } from './dto/room-response.dto';
import { Paginated } from '../common/types/paginated.type';

@Injectable()
export class RoomsService {
  constructor(private readonly roomsRepo: RoomsRepository) {}

  async list(query: ListRoomsQueryDto): Promise<Paginated<RoomResponseDto>> {
    const result = await this.roomsRepo.searchRooms(query);
    return {
      ...result,
      items: result.items.map((room) => RoomResponseDto.fromEntity(room)),
    };
  }

  async getById(id: string): Promise<RoomResponseDto> {
    const room = await this.roomsRepo.findOne({ id, isDeleted: false });
    if (!room) throw new NotFoundException('Không tìm thấy phòng trưng bày');
    return RoomResponseDto.fromEntity(room);
  }

  async create(dto: CreateRoomDto): Promise<RoomResponseDto> {
    const existing = await this.roomsRepo.findBySlug(dto.slug);
    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" đã được sử dụng`);
    }

    const room = this.roomsRepo.create({
      slug: dto.slug,
      name: dto.name,
      description: dto.description ?? null,
    });
    const saved = await this.roomsRepo.save(room);
    return RoomResponseDto.fromEntity(saved);
  }

  async update(id: string, dto: UpdateRoomDto): Promise<RoomResponseDto> {
    const room = await this.roomsRepo.findOne({ id, isDeleted: false });
    if (!room) throw new NotFoundException('Không tìm thấy phòng trưng bày');

    if (dto.name !== undefined) room.name = dto.name;
    if (dto.description !== undefined) room.description = dto.description ?? null;
    if (dto.status !== undefined) room.status = dto.status;

    const saved = await this.roomsRepo.save(room);
    return RoomResponseDto.fromEntity(saved);
  }

  async remove(id: string): Promise<void> {
    const room = await this.roomsRepo.findOne(
      { id, isDeleted: false },
      { relations: { exhibits: true } },
    );
    if (!room) throw new NotFoundException('Không tìm thấy phòng trưng bày');

    // Kiểm tra xem phòng có hiện vật nào đang hoạt động không
    if (room.exhibits && room.exhibits.length > 0) {
      throw new ConflictException('Không thể xóa phòng đang chứa hiện vật');
    }

    // Soft delete
    room.isDeleted = true;
    room.deletedAt = new Date();
    await this.roomsRepo.save(room);
  }
}
```

### 5.6 `rooms.controller.ts`
```typescript
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../core/auth/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constant';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { ListRoomsQueryDto } from './dto/list-rooms-query.dto';
import { RoomResponseDto } from './dto/room-response.dto';

@ApiTags('Admin - Rooms Management')
@ApiBearerAuth()
@Controller('admin/rooms')
export class RoomsController {
  constructor(private readonly service: RoomsService) {}

  @Get()
  @Permissions(PERMISSIONS.ROOM_READ)
  @ApiOperation({ summary: 'Danh sách phòng trưng bày (Admin)' })
  list(@Query() query: ListRoomsQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ROOM_READ)
  @ApiOperation({ summary: 'Chi tiết phòng trưng bày theo ID' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @Permissions(PERMISSIONS.ROOM_CREATE)
  @ApiOperation({ summary: 'Tạo phòng trưng bày mới' })
  create(@Body() dto: CreateRoomDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ROOM_UPDATE)
  @ApiOperation({ summary: 'Cập nhật thông tin phòng trưng bày' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ROOM_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa mềm phòng trưng bày' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
    return { message: 'Xóa phòng trưng bày thành công' };
  }
}
```

---

## 6. Kế hoạch kiểm chứng (Verification Checklist)

Trước khi commit và tạo PR:
- [ ] `POST /api/admin/rooms`: Body hợp lệ $\rightarrow$ HTTP 201 + dữ liệu trả về chuẩn `RoomResponseDto`.
- [ ] `POST /api/admin/rooms`: Slug đã tồn tại $\rightarrow$ HTTP 409 Conflict với thông báo rõ ràng.
- [ ] `POST /api/admin/rooms`: Slug chứa khoảng trắng hoặc ký tự đặc biệt $\rightarrow$ HTTP 422 Validation Error.
- [ ] `GET /api/admin/rooms`: Trả danh sách có envelope `{ success: true, data, meta: { page, pageSize, total } }`.
- [ ] `GET /api/admin/rooms?q=kham-pha`: Lọc kết quả tìm kiếm theo từ khóa.
- [ ] `PATCH /api/admin/rooms/:id`: Cập nhật tên phòng $\rightarrow$ HTTP 200.
- [ ] `DELETE /api/admin/rooms/:id`: Phòng có hiện vật $\rightarrow$ HTTP 409 Conflict.
- [ ] `DELETE /api/admin/rooms/:id`: Phòng rỗng $\rightarrow$ HTTP 200; bản ghi trong DB chuyển `is_deleted = true, deleted_at IS NOT NULL`.
- [ ] Không truyền JWT Bearer $\rightarrow$ HTTP 401 Unauthorized.
- [ ] Tài khoản không có quyền `room:create` $\rightarrow$ HTTP 403 Forbidden.
- [ ] Quality gates:
  ```bash
  cd back-end
  npm run typecheck
  npm run lint
  npm run build
  ```

