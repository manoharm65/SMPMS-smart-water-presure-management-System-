import { IsString, IsArray, ValidateNested, IsNumber, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncReadingDto {
  @IsNumber()
  @Min(0, { message: 'Pressure cannot be negative' })
  @Max(20, { message: 'Pressure cannot exceed 20 BAR' })
  pressure!: number;

  @IsNumber()
  @Min(0, { message: 'Valve position minimum is 0' })
  @Max(100, { message: 'Valve position maximum is 100' })
  valvePosition!: number;

  @IsString()
  timestamp!: string;
}

export class SyncTelemetryDto {
  @IsString()
  @Matches(/^DMA-[A-Z0-9]{1,20}$/, { message: 'nodeId must match DMA-XXX format' })
  nodeId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncReadingDto)
  readings!: SyncReadingDto[];
}
