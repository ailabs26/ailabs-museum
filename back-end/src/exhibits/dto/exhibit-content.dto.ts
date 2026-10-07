import { IsHexColor, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

// Contract for the future authenticated CMS write API. No public write route uses it yet.
export class ExhibitContentDto {
  @IsUUID() roomId!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsString() description!: string;
  @IsNumber() positionX!: number;
  @IsNumber() positionY!: number;
  @IsNumber() positionZ!: number;
  @IsIn(['box', 'sphere', 'cylinder', 'cone', 'torus']) placeholderShape!: string;
  @IsHexColor() placeholderColor!: string;
  @IsInt() @Min(0) displayOrder!: number;
  @IsOptional() @IsString() transcript?: string;
  @IsOptional() @IsUUID() modelId?: string;
  @IsOptional() @IsUUID() imageId?: string;
  @IsOptional() @IsUUID() audioId?: string;
}
