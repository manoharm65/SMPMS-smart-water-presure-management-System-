import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class RegisterIwedsDeviceDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,64}$/)
  household_id!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,64}$/)
  dma_id!: string;

  @IsInt()
  @Min(8)
  @Max(100)
  pipe_diameter_mm!: number;

  @IsString()
  @Matches(/^.{3,256}$/)
  address!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,64}$/)
  consumer_id!: string;
}
