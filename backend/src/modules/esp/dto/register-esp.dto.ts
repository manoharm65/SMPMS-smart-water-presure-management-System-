import { IsString, Matches } from 'class-validator';

export class RegisterEspDto {
  @IsString()
  @Matches(/^DMA-[A-Z0-9]{1,20}$/, { message: 'nodeId must match DMA-XXX format (e.g., DMA-A1)' })
  nodeId!: string;

  @IsString()
  firmwareVersion!: string;

  @IsString()
  ipAddress!: string;
}
