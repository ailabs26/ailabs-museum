import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repository/base.repository';
import { Role } from '../entities/role.entity';

@Injectable()
export class RolesRepository extends BaseRepository<Role> {
  constructor(@InjectRepository(Role) repo: Repository<Role>) {
    super(repo);
  }

  findByCode(code: string): Promise<Role | null> {
    return this.repo.findOne({ where: { code } });
  }

  existsByCode(code: string): Promise<boolean> {
    return this.exists({ code });
  }

  listWithPermissions(): Promise<Role[]> {
    return this.repo.find({
      relations: ['rolePermissions', 'rolePermissions.permission'],
      order: { code: 'ASC' },
    });
  }

  findWithPermissions(id: string): Promise<Role | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['rolePermissions', 'rolePermissions.permission'],
    });
  }
}
