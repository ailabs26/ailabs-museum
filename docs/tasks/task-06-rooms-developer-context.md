# Task T-ROOMS (Task 6): RoomsModule — Quản lý Phòng trưng bày

**Phụ trách:** Nguyễn Trọng Thành (Fullstack / CMS Frontend & QA Lead)  
**Thời gian thực hiện:** 11/10/2026 – 14/10/2026 (Phase 1 — MVP)  
**Nhánh triển khai:** `feat/be-rooms-crud` (rẽ từ bản `dev` mới nhất)  
**Tài liệu quy chuẩn liên quan:**
- Đặc tả yêu cầu hệ thống: [`../requirements.md`](../requirements.md) (FR-108, BR-07, BR-20, FR-106, FR-100 → FR-105)
- Quy ước lập trình Backend: [`../../back-end/docs/coding-conventions.md`](../../back-end/docs/coding-conventions.md)
- Hướng dẫn tổng kho mã nguồn: [`../../AGENTS.md`](../../AGENTS.md)
- Bộ sơ đồ chuẩn:
  - Sơ đồ quan hệ thực thể (ERD): [`../Diagrams/01-erd.md`](../Diagrams/01-erd.md) (bảng `rooms` & quan hệ `exhibits`)
  - Sơ đồ phân quyền (RBAC): [`../Diagrams/02-rbac.md`](../Diagrams/02-rbac.md)
  - Sơ đồ xác thực (Auth Flow): [`../Diagrams/03-auth-flow.md`](../Diagrams/03-auth-flow.md)
- Kế hoạch phân hệ Quản trị: [`../plans/admin-subsystem-plan.md`](../plans/admin-subsystem-plan.md)

---

## 1. Bối cảnh kiến trúc hiện tại (Enterprise Architecture Context)

Hệ thống Backend NestJS đã được tái cấu trúc đồng bộ theo mô hình Enterprise Modular (PR #20) với các quy ước bắt buộc:

1. **Tầng Hạ tầng dùng chung (`back-end/src/common/`):**
   - **`BaseRepository<T>`** (`src/common/repository/base.repository.ts`): Cung cấp các thao tác chuẩn `findById`, `findOne`, `findMany`, `paginate`, `create`, `save`, `update`, `softDelete`, `remove`. **Service tuyệt đối không chạm trực tiếp vào TypeORM `Repository<T>` mà phải thông qua `RoomsRepository`**.
   - **`ApiResponse<T>` & `ResponseInterceptor`** (`src/common/interceptors/response.interceptor.ts`): Tự động bao bọc dữ liệu trả về từ Controller thành cấu trúc chuẩn:
     ```json
     {
       "success": true,
       "data": ...,
       "message": null,
       "meta": { "page": 1, "pageSize": 20, "total": 1 }
     }
     ```
     Controller trả về dữ liệu thô hoặc `Paginated<T>`, **không tự bọc `ApiResponse` thủ công**.
   - **`AllExceptionsFilter`** (`src/common/filters/all-exceptions.filter.ts`): Bắt toàn bộ lỗi và chuẩn hóa thành envelope lỗi:
     - `NotFoundException` $\rightarrow$ HTTP 404
     - `ConflictException` $\rightarrow$ HTTP 409
     - `ValidationException` / `BadRequestException` $\rightarrow$ HTTP 422 / 400
     - `UnauthorizedException` $\rightarrow$ HTTP 401
     - `ForbiddenException` $\rightarrow$ HTTP 403

2. **Tầng Xác thực & Phân quyền RBAC (`back-end/src/common/guards/`):**
   - `JwtAuthGuard` & `PermissionsGuard` được kích hoạt toàn cục trong `CommonModule`.
   - Mọi route mặc định **đều yêu cầu Bearer JWT Token**, trừ những route được đánh dấu `@Public()`.
   - Phân quyền theo action bằng decorator `@Permissions(...)` (`src/common/decorators/permissions.decorator.ts`).
   - Lấy thông tin user đang đăng nhập qua `@CurrentUser()` (`src/common/decorators/current-user.decorator.ts`).

3. **Hệ thống Kiểm toán (Audit Logging - PR #19, #20):**
   - Theo quy định tại `AGENTS.md`: *Mọi thao tác ghi/sửa/xóa ở route quản trị phải được đánh dấu bằng `@Audit(...)`* (`src/modules/audit/decorators/audit.decorator.ts`).
   - Decorator này tự động ghi log vào bảng `audit_logs` gồm `actor_id`, `action`, `resource`, `resource_id`, `diff`, `ip_address`, `user_agent`.

4. **Mã quyền đã định nghĩa sẵn (`back-end/src/common/constants/permissions.constant.ts`):**
   ```typescript
   PERMISSIONS.ROOM_READ   = 'room:read';    // Xem danh sách và chi tiết phòng
   PERMISSIONS.ROOM_CREATE = 'room:create';  // Tạo phòng trưng bày mới
   PERMISSIONS.ROOM_UPDATE = 'room:update';  // Chỉnh sửa thông tin phòng
   PERMISSIONS.ROOM_DELETE = 'room:delete';  // Xóa / lưu trữ phòng
   ```

---

## 2. Mô hình Dữ liệu & Entity `Room`

Thực thể `Room` đã được tạo sẵn tại [`back-end/src/modules/rooms/entities/room.entity.ts`](../../back-end/src/modules/rooms/entities/room.entity.ts) với cấu trúc schema PostgreSQL:

```typescript
export enum RoomStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

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

### Các ràng buộc cốt lõi (Core Invariants):
1. **Xóa mềm (Soft-delete):** Hệ thống dùng cờ `isDeleted = true` và `deletedAt = new Date()`. Check constraint DB yêu cầu `is_deleted` đồng bộ tuyệt đối với `deleted_at IS NOT NULL`.
2. **Slug Unique & Bất biến:** Slug là duy nhất toàn hệ thống, tuân thủ kebab-case (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`). Một khi đã tạo, **không cho phép sửa slug** qua API update để bảo toàn định danh permalink URL cho client 3D.
3. **Toàn vẹn quan hệ (BR-20):** Không được xóa phòng nếu phòng đang liên kết với các hiện vật. Phải kiểm tra quan hệ `exhibits` trước khi soft-delete.

---

## 3. Cấu trúc Thư mục triển khai (`back-end/src/modules/rooms/`)

Toàn bộ mã nguồn Task 6 được tổ chức theo chuẩn Enterprise Module:

```text
back-end/src/modules/rooms/
├── entities/
│   └── room.entity.ts                 # Thực thể TypeORM (đã có sẵn)
├── dto/
│   ├── create-room.dto.ts             # Validate dữ liệu tạo phòng mới
│   ├── update-room.dto.ts             # Validate dữ liệu cập nhật
│   ├── list-rooms-query.dto.ts        # Phân trang, từ khóa q, lọc status
│   └── room-response.dto.ts           # DTO trả về cho client (loại bỏ dữ liệu nhạy cảm, map exhibitsCount)
├── repositories/
│   └── rooms.repository.ts            # Kế thừa BaseRepository<Room>, bọc truy vấn TypeORM
├── services/
│   └── rooms.service.ts               # Nghiệp vụ: CRUD, kiểm tra slug trùng, kiểm tra quan hệ khi xóa
├── controllers/
│   ├── rooms-admin.controller.ts      # Endpoints quản trị (/api/admin/rooms) với @Permissions và @Audit
│   └── rooms-public.controller.ts     # Endpoints công khai (/api/rooms) với @Public()
└── rooms.module.ts                    # Khai báo NestJS Module, TypeOrmModule.forFeature([Room])
```

---

## 4. Đặc tả Hợp đồng API (API Contract)

### 4.1 Nhóm API Quản trị (Admin CMS) — Prefix: `/api/admin/rooms`

#### A. Danh sách phòng trưng bày (Phân trang & Tìm kiếm)
- **Method & Path:** `GET /api/admin/rooms`
- **Quyền yêu cầu:** `@Permissions(PERMISSIONS.ROOM_READ)`
- **Query Params:**
  - `page`: number (tùy chọn, mặc định: 1, tối thiểu: 1)
  - `pageSize`: number (tùy chọn, mặc định: 20, tối đa: 100)
  - `q`: string (tùy chọn — tìm kiếm `ILIKE` theo `name` hoặc `slug`)
  - `status`: enum `active` | `archived` (tùy chọn)
- **Response thành công (HTTP 200):**
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
        "createdAt": "2026-10-10T10:00:00.000Z",
        "updatedAt": "2026-10-10T10:00:00.000Z"
      }
    ],
    "message": null,
    "meta": { "page": 1, "pageSize": 20, "total": 1 }
  }
  ```

#### B. Xem chi tiết phòng theo ID
- **Method & Path:** `GET /api/admin/rooms/:id`
- **Quyền yêu cầu:** `@Permissions(PERMISSIONS.ROOM_READ)`
- **Tham số:** `:id` (UUID format qua `ParseUUIDPipe`)
- **Mã lỗi:** HTTP 404 nếu không tìm thấy hoặc bản ghi có `isDeleted = true`.

#### C. Tạo phòng mới
- **Method & Path:** `POST /api/admin/rooms`
- **Quyền & Audit:** 
  - `@Permissions(PERMISSIONS.ROOM_CREATE)`
  - `@Audit({ action: 'create', resource: 'room' })`
- **Request Body:**
  ```json
  {
    "slug": "phong-my-thuat-hien-dai",
    "name": "Phòng Mỹ Thuật Hiện Đại",
    "description": "Trưng bày các tác phẩm thế kỷ 20"
  }
  ```
- **Validation Rules:**
  - `slug`: Bắt buộc, chuỗi 1–120 ký tự, định dạng kebab-case `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`. Nếu đã tồn tại $\rightarrow$ `409 Conflict`.
  - `name`: Bắt buộc, chuỗi 1–200 ký tự (trim whitespace).
  - `description`: Tùy chọn, string hoặc null.
- **Response thành công:** HTTP 201 Created.

#### D. Cập nhật phòng
- **Method & Path:** `PATCH /api/admin/rooms/:id`
- **Quyền & Audit:** 
  - `@Permissions(PERMISSIONS.ROOM_UPDATE)`
  - `@Audit({ action: 'update', resource: 'room' })`
- **Request Body:**
  ```json
  {
    "name": "Phòng Mỹ Thuật Cận Đại (Đã sửa)",
    "description": "Mô tả mới",
    "status": "archived"
  }
  ```
- **Quy tắc:** Không cho phép sửa `slug`. Chỉ cập nhật `name`, `description`, `status`.

#### E. Xóa mềm phòng (Soft-delete)
- **Method & Path:** `DELETE /api/admin/rooms/:id`
- **Quyền & Audit:** 
  - `@Permissions(PERMISSIONS.ROOM_DELETE)`
  - `@Audit({ action: 'delete', resource: 'room' })`
- **Quy tắc nghiệm thu (BR-20):**
  - Kiểm tra xem phòng có hiện vật nào đang liên kết (`exhibits.length > 0`) hay không.
  - Nếu phòng **đang chứa hiện vật** $\rightarrow$ Ném `ConflictException` (HTTP 409): *"Không thể xóa phòng đang chứa hiện vật. Vui lòng chuyển hoặc gỡ hiện vật trước khi xóa phòng."*
  - Nếu phòng rỗng $\rightarrow$ Đánh dấu `isDeleted = true`, `deletedAt = new Date()`, lưu DB và trả về thông báo thành công (HTTP 200).

---

### 4.2 Nhóm API Công khai (Public / Visitor) — Prefix: `/api/rooms`

Theo `AGENTS.md` (*"Giữ các endpoint nội dung công khai (/rooms, /health) ở chế độ chỉ đọc + @Public()"*):

#### A. Danh sách phòng công khai
- **Method & Path:** `GET /api/rooms`
- **Đánh dấu:** `@Public()` (không cần Bearer Token)
- **Logic:** Chỉ trả về các phòng có `status = 'active'` và `isDeleted = false`.

#### B. Xem thông tin phòng công khai theo slug
- **Method & Path:** `GET /api/rooms/:slug`
- **Đánh dấu:** `@Public()`
- **Logic:** Tìm phòng theo `slug`, `status = 'active'`, `isDeleted = false`.

---

## 5. Chi tiết Thiết kế Mã nguồn (Production Ready Blueprint)

### 5.1 DTOs

#### `src/modules/rooms/dto/create-room.dto.ts`
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: 'phong-kham-pha', description: 'Định danh slug duy nhất theo chuẩn kebab-case' })
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

  @ApiPropertyOptional({ example: 'Không gian trưng bày các hiện vật khảo cổ', description: 'Mô tả chi tiết phòng' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;
}
```

#### `src/modules/rooms/dto/update-room.dto.ts`
```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RoomStatus } from '../entities/room.entity';

export class UpdateRoomDto {
  @ApiPropertyOptional({ example: 'Phòng Khám Phá (Cập nhật)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên phòng không được để rỗng nếu cung cấp' })
  @MaxLength(200, { message: 'Tên phòng không được vượt quá 200 ký tự' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ example: 'Mô tả mới của phòng' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @ApiPropertyOptional({ enum: RoomStatus, example: RoomStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RoomStatus, { message: 'Trạng thái phòng phải là active hoặc archived' })
  status?: RoomStatus;
}
```

#### `src/modules/rooms/dto/list-rooms-query.dto.ts`
```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { RoomStatus } from '../entities/room.entity';

export class ListRoomsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên hoặc slug phòng' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: RoomStatus, description: 'Lọc theo trạng thái phòng' })
  @IsOptional()
  @IsEnum(RoomStatus, { message: 'Trạng thái lọc không hợp lệ' })
  status?: RoomStatus;
}
```

#### `src/modules/rooms/dto/room-response.dto.ts`
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Room, RoomStatus } from '../entities/room.entity';

export class RoomResponseDto {
  @ApiProperty({ example: 'e4b50c18-971c-4b68-b39f-f5cf171a8123' })
  id!: string;

  @ApiProperty({ example: 'phong-kham-pha' })
  slug!: string;

  @ApiProperty({ example: 'Phòng Khám Phá' })
  name!: string;

  @ApiPropertyOptional({ example: 'Mô tả phòng', nullable: true })
  description!: string | null;

  @ApiProperty({ enum: RoomStatus, example: RoomStatus.ACTIVE })
  status!: RoomStatus;

  @ApiProperty({ example: 3, description: 'Số lượng hiện vật thuộc phòng' })
  exhibitsCount!: number;

  @ApiProperty({ example: '2026-10-10T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-10-10T10:00:00.000Z' })
  updatedAt!: Date;

  static fromEntity(entity: Room, exhibitsCount: number = 0): RoomResponseDto {
    const dto = new RoomResponseDto();
    dto.id = entity.id;
    dto.slug = entity.slug;
    dto.name = entity.name;
    dto.description = entity.description ?? null;
    dto.status = entity.status;
    dto.exhibitsCount = entity.exhibits ? entity.exhibits.length : exhibitsCount;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
```

---

### 5.2 Repository Layer (`src/modules/rooms/repositories/rooms.repository.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { BaseRepository } from '../../../common/repository/base.repository';
import { Paginated } from '../../../common/types/paginated.type';
import { ListRoomsQueryDto } from '../dto/list-rooms-query.dto';
import { Room, RoomStatus } from '../entities/room.entity';

@Injectable()
export class RoomsRepository extends BaseRepository<Room> {
  constructor(@InjectRepository(Room) repo: Repository<Room>) {
    super(repo);
  }

  async findBySlug(slug: string): Promise<Room | null> {
    return this.findOne({ slug, isDeleted: false });
  }

  async findActiveBySlug(slug: string): Promise<Room | null> {
    return this.findOne({ slug, status: RoomStatus.ACTIVE, isDeleted: false });
  }

  async findWithExhibits(id: string): Promise<Room | null> {
    return this.findOne(
      { id, isDeleted: false },
      { relations: { exhibits: true } },
    );
  }

  async searchRooms(query: ListRoomsQueryDto): Promise<Paginated<Room>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb: SelectQueryBuilder<Room> = this.repo
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.exhibits', 'exhibit')
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

  async findPublicRooms(): Promise<Room[]> {
    return this.findMany(
      { status: RoomStatus.ACTIVE, isDeleted: false },
      { relations: { exhibits: true }, order: { createdAt: 'ASC' } },
    );
  }
}
```

---

### 5.3 Service Layer (`src/modules/rooms/services/rooms.service.ts`)

```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Paginated } from '../../../common/types/paginated.type';
import { CreateRoomDto } from '../dto/create-room.dto';
import { ListRoomsQueryDto } from '../dto/list-rooms-query.dto';
import { RoomResponseDto } from '../dto/room-response.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { RoomsRepository } from '../repositories/rooms.repository';

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
    const room = await this.roomsRepo.findWithExhibits(id);
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng trưng bày');
    }
    return RoomResponseDto.fromEntity(room);
  }

  async getPublicList(): Promise<RoomResponseDto[]> {
    const rooms = await this.roomsRepo.findPublicRooms();
    return rooms.map((room) => RoomResponseDto.fromEntity(room));
  }

  async getPublicBySlug(slug: string): Promise<RoomResponseDto> {
    const room = await this.roomsRepo.findActiveBySlug(slug);
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng trưng bày');
    }
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
    const room = await this.roomsRepo.findWithExhibits(id);
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng trưng bày');
    }

    if (dto.name !== undefined) {
      room.name = dto.name;
    }
    if (dto.description !== undefined) {
      room.description = dto.description ?? null;
    }
    if (dto.status !== undefined) {
      room.status = dto.status;
    }

    const saved = await this.roomsRepo.save(room);
    return RoomResponseDto.fromEntity(saved);
  }

  async remove(id: string): Promise<void> {
    const room = await this.roomsRepo.findWithExhibits(id);
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng trưng bày');
    }

    // BR-20: Không được xóa phòng nếu đang có hiện vật liên kết
    if (room.exhibits && room.exhibits.length > 0) {
      throw new ConflictException(
        'Không thể xóa phòng đang chứa hiện vật. Vui lòng chuyển hoặc gỡ hiện vật trước khi xóa phòng.',
      );
    }

    // Thực hiện soft-delete chuẩn check-constraint
    room.isDeleted = true;
    room.deletedAt = new Date();
    await this.roomsRepo.save(room);
  }
}
```

---

### 5.4 Controller Layer

#### Quản trị Admin: `src/modules/rooms/controllers/rooms-admin.controller.ts`
```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { Audit } from '../../audit/decorators/audit.decorator';
import { CreateRoomDto } from '../dto/create-room.dto';
import { ListRoomsQueryDto } from '../dto/list-rooms-query.dto';
import { RoomResponseDto } from '../dto/room-response.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { RoomsService } from '../services/rooms.service';

@ApiTags('Admin - Rooms Management')
@ApiBearerAuth()
@Controller('admin/rooms')
export class RoomsAdminController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @Permissions(PERMISSIONS.ROOM_READ)
  @ApiOperation({ summary: 'Danh sách phòng trưng bày (Admin - có phân trang & lọc)' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách thành công', type: [RoomResponseDto] })
  list(@Query() query: ListRoomsQueryDto) {
    return this.roomsService.list(query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ROOM_READ)
  @ApiOperation({ summary: 'Chi tiết phòng trưng bày theo ID' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết thành công', type: RoomResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomsService.getById(id);
  }

  @Post()
  @Permissions(PERMISSIONS.ROOM_CREATE)
  @Audit({ action: 'create', resource: 'room' })
  @ApiOperation({ summary: 'Tạo phòng trưng bày mới' })
  @ApiResponse({ status: 201, description: 'Tạo phòng thành công', type: RoomResponseDto })
  @ApiResponse({ status: 409, description: 'Slug đã tồn tại' })
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ROOM_UPDATE)
  @Audit({ action: 'update', resource: 'room' })
  @ApiOperation({ summary: 'Cập nhật thông tin phòng trưng bày' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công', type: RoomResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto) {
    return this.roomsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ROOM_DELETE)
  @Audit({ action: 'delete', resource: 'room' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa mềm phòng trưng bày' })
  @ApiResponse({ status: 200, description: 'Xóa phòng thành công' })
  @ApiResponse({ status: 409, description: 'Phòng đang chứa hiện vật, không thể xóa' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.roomsService.remove(id);
    return { message: 'Xóa phòng trưng bày thành công' };
  }
}
```

#### Công khai Visitor: `src/modules/rooms/controllers/rooms-public.controller.ts`
```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { RoomResponseDto } from '../dto/room-response.dto';
import { RoomsService } from '../services/rooms.service';

@ApiTags('Public - Rooms')
@Controller('rooms')
export class RoomsPublicController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Danh sách phòng trưng bày công khai cho khách tham quan' })
  @ApiResponse({ status: 200, description: 'Thành công', type: [RoomResponseDto] })
  getPublicRooms() {
    return this.roomsService.getPublicList();
  }

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Chi tiết phòng trưng bày công khai theo slug' })
  @ApiResponse({ status: 200, description: 'Thành công', type: RoomResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng' })
  getPublicBySlug(@Param('slug') slug: string) {
    return this.roomsService.getPublicBySlug(slug);
  }
}
```

---

### 5.5 Module Layer (`src/modules/rooms/rooms.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsAdminController } from './controllers/rooms-admin.controller';
import { RoomsPublicController } from './controllers/rooms-public.controller';
import { Room } from './entities/room.entity';
import { RoomsRepository } from './repositories/rooms.repository';
import { RoomsService } from './services/rooms.service';

@Module({
  imports: [TypeOrmModule.forFeature([Room])],
  controllers: [RoomsAdminController, RoomsPublicController],
  providers: [RoomsRepository, RoomsService],
  exports: [RoomsService, RoomsRepository],
})
export class RoomsModule {}
```

---

## 6. Kế hoạch Commit Từng Phần (Granular Commits Breakdown)

Tuân thủ nghiêm ngặt quy định tại `AGENTS.md` (chia thành các commit nhỏ, độc lập, có thể review dễ dàng):

| STT | Commit Type & Scope | Mô tả chi tiết | Các file tác động |
| :--- | :--- | :--- | :--- |
| **1** | `feat(rooms-dto)` | Khai báo các DTO tạo, cập nhật, truy vấn phân trang và response mapping | `src/modules/rooms/dto/*` |
| **2** | `feat(rooms-repo)` | Cài đặt `RoomsRepository` kế thừa `BaseRepository<Room>` và tìm kiếm phân trang | `src/modules/rooms/repositories/rooms.repository.ts` |
| **3** | `feat(rooms-service)` | Cài đặt `RoomsService` xử lý nghiệp vụ slug unique, kiểm tra quan hệ BR-20 và soft delete | `src/modules/rooms/services/rooms.service.ts` |
| **4** | `feat(rooms-controllers)` | Cài đặt `RoomsAdminController` (có `@Permissions`, `@Audit`) và `RoomsPublicController` (`@Public`) | `src/modules/rooms/controllers/*` |
| **5** | `feat(rooms-module)` | Khai báo `RoomsModule`, xuất service/repo và đăng ký vào `AppModule` | `src/modules/rooms/rooms.module.ts`, `src/app.module.ts` |

---

## 7. Ma trận Kiểm chứng Chất lượng (Verification Test Matrix)

| Test Case ID | Mục tiêu kiểm tra | Phương thức & URL | Dữ liệu đầu vào / Headers | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Tạo phòng hợp lệ | `POST /api/admin/rooms` | Bearer Token (`admin`), Body: `{ "slug": "phong-1", "name": "Phòng 1" }` | HTTP 201 Created + Object chuẩn `RoomResponseDto`. Bản ghi mới trong DB. Ghi 1 bản ghi vào `audit_logs`. |
| **TC-02** | Trùng lặp slug | `POST /api/admin/rooms` | Bearer Token (`admin`), Body: `{ "slug": "phong-1", "name": "Tên khác" }` | HTTP 409 Conflict: `Slug "phong-1" đã được sử dụng`. |
| **TC-03** | Slug sai format | `POST /api/admin/rooms` | Bearer Token, Body: `{ "slug": "Phong Co Dau!" }` | HTTP 422 Unprocessable Entity (Validation failed). |
| **TC-04** | Danh sách phân trang | `GET /api/admin/rooms?page=1&pageSize=10` | Bearer Token (`room:read`) | HTTP 200 OK, envelope `{ success: true, data: [...], meta: { page: 1, pageSize: 10, total } }`. |
| **TC-05** | Tìm kiếm theo từ khóa | `GET /api/admin/rooms?q=phong-1` | Bearer Token (`room:read`) | HTTP 200 OK, chỉ trả về các phòng khớp `name` hoặc `slug`. |
| **TC-06** | Lấy chi tiết phòng | `GET /api/admin/rooms/:id` | Bearer Token, ID hợp lệ | HTTP 200 OK + `RoomResponseDto`. |
| **TC-07** | Lấy ID không tồn tại | `GET /api/admin/rooms/:id` | UUID ngẫu nhiên không có trong DB | HTTP 404 Not Found. |
| **TC-08** | Cập nhật tên phòng | `PATCH /api/admin/rooms/:id` | Bearer Token, Body: `{ "name": "Tên Mới" }` | HTTP 200 OK. Bản ghi được cập nhật trong DB. Ghi log vào `audit_logs`. |
| **TC-09** | Xóa phòng có hiện vật | `DELETE /api/admin/rooms/:id` | Phòng đang chứa hiện vật (`exhibitsCount > 0`) | HTTP 409 Conflict: Từ chối xóa. Dữ liệu không đổi. |
| **TC-10** | Xóa phòng rỗng | `DELETE /api/admin/rooms/:id` | Phòng không có hiện vật | HTTP 200 OK. DB cập nhật `is_deleted = true`, `deleted_at IS NOT NULL`. Ghi log `audit_logs`. |
| **TC-11** | Chặn request không token | `GET /api/admin/rooms` | Không gửi header Authorization | HTTP 401 Unauthorized. |
| **TC-12** | Chặn không đủ quyền | `POST /api/admin/rooms` | Bearer Token của user chỉ có quyền `room:read` | HTTP 403 Forbidden. |
| **TC-13** | Xem công khai không token | `GET /api/rooms` | Không gửi Token | HTTP 200 OK (Route `@Public`). Chỉ trả phòng active & chưa xóa. |

### Lệnh kiểm tra chất lượng (Quality Gates):
```bash
cd back-end
npm run typecheck    # Không có lỗi TypeScript (tsc --noEmit)
npm run lint         # Không có lỗi ESLint (eslint .)
npm run build        # Biên dịch NestJS thành công
```
