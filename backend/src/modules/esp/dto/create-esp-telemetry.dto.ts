import { IsString, IsNumber, IsOptional, Min, Max, Matches } from 'class-validator';

export class CreateEspTelemetryDto {
  @IsString()
  @Matches(/^DMA_[A-Z0-9]{1,20}$/, { message: 'nodeId must match DMA_XXX format (e.g., DMA_01)' })
  nodeId!: string;

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
