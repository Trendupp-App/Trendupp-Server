import { FindAndCountOptions, Model, ModelStatic } from 'sequelize';

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export async function paginate<M extends Model>(
  model: ModelStatic<M>,
  options: FindAndCountOptions = {},
  pagination: { page: number; limit: number },
): Promise<PaginatedResult<M>> {
  const page = Math.max(1, pagination.page || 1);
  const limit = Math.max(1, pagination.limit || 10);
  const offset = (page - 1) * limit;

  // Run the findAndCountAll query
  const { count, rows } = await model.findAndCountAll({
    ...options,
    limit,
    offset,
  });

  const pages = Math.ceil(count / limit);

  return {
    data: rows,
    pagination: {
      total: count,
      page,
      limit,
      pages,
    },
  };
}
