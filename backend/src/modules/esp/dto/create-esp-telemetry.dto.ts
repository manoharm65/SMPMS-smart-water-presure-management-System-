import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateEspTelemetryDto {
  @IsString()
  nodeId!: string;

  @IsNumber()
  pressure!: number;

  @IsNumber()
  valvePosition!: number;

  @IsString()
  timestamp!: string;
}
