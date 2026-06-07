import { Injectable } from '@nestjs/common';
import { Attributes } from 'sequelize';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repository/user.repository';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  findOne(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  create(data: Partial<Attributes<User>>): Promise<User> {
    return this.userRepository.create(data);
  }

  remove(id: string): Promise<number> {
    return this.userRepository.remove(id);
  }
}
