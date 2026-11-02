import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Slug dành riêng cho route tĩnh dưới `/rooms` (vd `GET /rooms/search` của VT-077).
 * Nếu cho admin tạo phòng trùng các slug này, `GET /rooms/<slug>` sẽ bị route tĩnh nuốt → phòng không truy cập được.
 */
export const RESERVED_ROOM_SLUGS = ['search'] as const;

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty({ message: 'Slug không được để trống' })
  @MaxLength(120, { message: 'Slug không được vượt quá 120 ký tự' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ được chứa chữ thường không dấu, số và gạch ngang (kebab-case)',
  })
  @Matches(new RegExp(`^(?!(?:${RESERVED_ROOM_SLUGS.join('|')})$).*$`), {
    message: `Slug không được trùng từ khóa dành riêng (${RESERVED_ROOM_SLUGS.join(', ')})`,
  })
  slug!: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên phòng không được để trống' })
  @MaxLength(200, { message: 'Tên phòng không được vượt quá 200 ký tự' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;
}
