import { ModelCtor } from 'sequelize-typescript';
import { Attributes, WhereOptions } from 'sequelize';
import { BaseEntity } from './base.entity';

export abstract class BaseService<T extends BaseEntity<T>> {
  constructor(protected readonly repository: ModelCtor<T>) {}

  findAll(): Promise<T[]> {
    return this.repository.findAll();
  }

  findOne(id: string): Promise<T | null> {
    return this.repository.findByPk(id);
  }

  create(data: Partial<Attributes<T>>): Promise<T> {
    // Sequelize's MakeNullishOptional<T['_creationAttributes']> is a conditional
    // mapped type that cannot be satisfied through an abstract generic chain.
    // Casting the repo to any only at this boundary is the idiomatic escape.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.repository as any).create(data) as Promise<T>;
  }

  update(id: string, data: Partial<Attributes<T>>): Promise<[number, T[]]> {
    const where = { id } as unknown as WhereOptions<Attributes<T>>;
    return this.repository.update(data, { where, returning: true });
  }

  remove(id: string): Promise<number> {
    const where = { id } as unknown as WhereOptions<Attributes<T>>;
    return this.repository.destroy({ where });
  }
}
