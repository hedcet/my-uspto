import { IsArray, IsOptional } from 'class-validator';

export class RequestDto {
  @IsArray()
  @IsOptional()
  appNoList?: string[];

  @IsArray()
  @IsOptional()
  patentNoList?: string[];
}
