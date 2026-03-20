import { IsString } from 'class-validator';

export class RegisterEspDto {
  @IsString()
  nodeId!: string;

  @IsString()
  firmwareVersion!: string;

  @IsString()
  ipAddress!: string;
}
