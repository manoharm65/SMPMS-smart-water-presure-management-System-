import { IsString, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CommandAckDto {
  @IsString()
  commandId!: string;

  @IsNumber()
  executed!: number;  // 1 = true, 0 = false

  @IsNumber()
  @IsOptional()
  actualPosition?: number;
}

export class CreateTelemetryDto {
  @IsString()
  nodeId!: string;

  @IsNumber()
  @Min(0)
  pressure!: number;

  @IsNumber()
  @IsOptional()
  flowRate?: number;

  @IsNumber()
  @IsOptional()
  temperature?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  batteryLevel?: number;

  @ValidateNested()
  @Type(() => CommandAckDto)
  @IsOptional()
  ack?: CommandAckDto;
}
