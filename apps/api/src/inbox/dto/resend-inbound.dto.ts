import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ResendEmailHeaderDto {
  @IsString()
  name!: string;

  @IsString()
  value!: string;
}

export class ResendInboundEmailDataDto {
  @IsEmail()
  from!: string;

  @IsArray()
  @IsString({ each: true })
  to!: string[];

  @IsString()
  subject!: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResendEmailHeaderDto)
  headers?: ResendEmailHeaderDto[];
}

export class ResendInboundDto {
  @IsString()
  type!: string;

  @ValidateNested()
  @Type(() => ResendInboundEmailDataDto)
  data!: ResendInboundEmailDataDto;
}
