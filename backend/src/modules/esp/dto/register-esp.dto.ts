import { IsString, Matches } from 'class-validator';

export class RegisterEspDto {
  @IsString()
  @Matches(/^valve_[0-9]{1,20}$/, { message: 'nodeId must match valve_X format (e.g., valve_1)' })
  nodeId!: string;

  @IsString()
  firmwareVersion!: string;

  @IsString()
  ipAddress!: string;
}
