import { IsString, Matches } from 'class-validator';

export class RegisterEspDto {
  @IsString()
  @Matches(/^(valve|house)_[0-9]{1,20}$/, { message: 'nodeId must match valve_X or house_X format (e.g., valve_1, house_1)' })
  nodeId!: string;

  @IsString()
  firmwareVersion!: string;

  @IsString()
  ipAddress!: string;
}
