import { IsString, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncReadingDto {
  @IsNumber()
  pressure!: number;

  @IsNumber()
  valvePosition!: number;

  @IsString()
  timestamp!: string;
}

export class SyncTelemetryDto {
  @IsString()
  nodeId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncReadingDto)
  readings!: SyncReadingDto[];
}
