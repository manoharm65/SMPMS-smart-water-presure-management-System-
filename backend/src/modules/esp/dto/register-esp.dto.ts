import { IsString, Matches } from 'class-validator';

export class RegisterEspDto {
  @IsString()
  @Matches(/^DMA_[A-Z0-9]{1,20}$/, { message: 'nodeId must match DMA_XXX format (e.g., DMA_01)' })
  nodeId!: string;

  @IsString()
  firmwareVersion!: string;

  @IsString()
  ipAddress!: string;
}
