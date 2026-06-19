import { Injectable } from '@nestjs/common';
import { Attributes } from 'sequelize';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repository/user.repository';
import { RoleRepository } from '../repository/role.repository';
import { Role } from '../entities/role.entity';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
  ) {}

  findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  findOne(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  findOneWithNiches(id: string): Promise<User | null> {
    return this.userRepository.findById(id, true);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findByUsername(username);
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findByGoogleId(googleId);
  }

  findByTiktokOpenId(tiktokOpenId: string): Promise<User | null> {
    return this.userRepository.findByTiktokOpenId(tiktokOpenId);
  }

  findByInstagramOpenId(instagramOpenId: string): Promise<User | null> {
    return this.userRepository.findByInstagramOpenId(instagramOpenId);
  }

  setUserNiches(id: string, nicheIds: string[]): Promise<void> {
    return this.userRepository.setUserNiches(id, nicheIds);
  }

  findRoleByName(name: string): Promise<Role | null> {
    return this.roleRepository.findByName(name);
  }

  findRoleById(id: string): Promise<Role | null> {
    return this.roleRepository.findById(id);
  }

  findAllRoles(publicOnly = false): Promise<Role[]> {
    return this.roleRepository.findAll(publicOnly);
  }

  create(data: Partial<Attributes<User>>): Promise<User> {
    return this.userRepository.create(data);
  }

  async update(id: string, data: Partial<Attributes<User>>): Promise<User | null> {
    const user = await this.userRepository.findById(id);
    if (!user) return null;
    await user.update(data);
    return user;
  }

  remove(id: string): Promise<number> {
    return this.userRepository.remove(id);
  }
}
