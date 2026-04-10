import { IsIn, IsISO8601, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateHouseholdFlowDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,64}$/)
  household_id!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,64}$/)
  dma_id!: string;

  @IsISO8601()
  timestamp!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(5)
  flow_rate_lps!: number;

  @IsString()
  @IsIn(['GOOD', 'POOR', 'LOST'])
  signal_quality!: 'GOOD' | 'POOR' | 'LOST';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(-140)
  @Max(-10)
  rssi_dbm?: number;

  @IsString()
  @Matches(/^.{1,64}$/)
  firmware_version!: string;
}
