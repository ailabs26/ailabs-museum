# Tầng `core` — hạ tầng dùng chung (BE)

Không chứa nghiệp vụ. Mọi module `modules/*` dựa vào đây. Xem thiết kế:
[`docs/architecture/02-backend-architecture.md`](../../../docs/architecture/02-backend-architecture.md).

## Thành phần

| Thư mục | Nội dung | Dùng khi |
|---|---|---|
| `repository/` | `IBaseRepository<T>` (port) + `BaseRepository<T>` (adapter TypeORM) | Repository mỗi module `extends BaseRepository` |
| `http/` | `ApiResponse`, `ResponseInterceptor`, `AllExceptionsFilter` | Đăng ký global ở `main.ts` (đã bật) |
| `database/` | `TransactionManager` (UnitOfWork) | Luồng nguyên tử nhiều bảng (publish revision + audit) |
| `exceptions/` | `EntityNotFoundException`, `BusinessException`, `ConcurrencyConflictException`, `DomainValidationException` | Ném trong service, filter tự map status |
| `auth/` | `@Permissions`, `@Public`, `@CurrentUser`, `PermissionsGuard` | Bảo vệ route RBAC (JwtAuthGuard nối ở PR #D) |

## Dùng BaseRepository

```ts
@Injectable()
export class RoomsRepository extends BaseRepository<Room> {
  constructor(@InjectRepository(Room) repo: Repository<Room>) { super(repo); }
  findBySlug(slug: string) { return this.findOne({ slug } as FindOptionsWhere<Room>); }
}
```

## Bảo vệ route (sau khi #D bật JwtAuthGuard global)

```ts
@Post()
@Permissions(PERMISSIONS.ROOM_CREATE)
create(@Body() dto: CreateRoomDto, @CurrentUser() user: AuthUser) { ... }
```

## Response tự chuẩn hóa

Controller chỉ cần `return data` hoặc `return paginatedResult` — `ResponseInterceptor`
tự bọc thành `{ success, data }` hoặc `{ success, data, meta }`. Lỗi ném ra được
`AllExceptionsFilter` chuyển thành `{ success:false, message, errors }`.

> JwtAuthGuard + module auth/users/roles/audit được bổ sung ở **PR #C/#D**.
