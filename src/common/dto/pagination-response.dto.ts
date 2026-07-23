export class PaginationMetaDto {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class PaginatedResponseDto<T> {
  meta: PaginationMetaDto;
  data: T[];
}
