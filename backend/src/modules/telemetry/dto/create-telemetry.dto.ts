import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

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
}
