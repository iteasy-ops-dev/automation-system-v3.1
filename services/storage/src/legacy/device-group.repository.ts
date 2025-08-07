/**
 * Device Group Repository
 * 계약 기반 장비 그룹 관리 (계층적 구조 지원)
 * infrastructure/database/schemas/postgresql-schema.sql device_groups 테이블 기반
 */

import { Repository, EntityManager, TreeRepository } from 'typeorm';
import { DeviceGroup } from '../entities/device-group.entity';
import { BaseRepository, QueryOptions, PaginatedResult, FilterOptions } from './base.repository';
import { CacheService } from '../services/cache.service';
import { Logger } from '../utils/logger';

export interface DeviceGroupFilter extends FilterOptions {
  parentId?: string;
  name?: string;
  hasChildren?: boolean;
}

export interface DeviceGroupCreateInput {
  name: string;
  description?: string;
  parentId?: string;
  metadata?: Record<string, any>;
}

export interface DeviceGroupUpdateInput {
  name?: string;
  description?: string;
  parentId?: string;
  metadata?: Record<string, any>;
}

export class DeviceGroupRepository extends BaseRepository<DeviceGroup, string> {
  protected entityName = 'DeviceGroup';
  protected cachePrefix = 'device_group';

  constructor(
    private repository: Repository<DeviceGroup>,
    private treeRepository: TreeRepository<DeviceGroup>,
    cache: CacheService,
    logger: Logger
  ) {
    super(repository.manager, cache, logger);
  }

  /**
   * ID로 그룹 조회
   */
  async findById(id: string): Promise<DeviceGroup | null> {
    try {
      const cacheKey = this.getCacheKey(id);
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const group = await this.repository.findOne({
        where: { id },
        relations: ['parent', 'children', 'devices']
      });

      if (group) {
        await this.cache.setex(cacheKey, 60, JSON.stringify(group));
      }

      return group;
    } catch (error) {
      this.handleError('findById', error, { id });
    }
  }

  /**
   * 그룹 목록 조회
   */
  async findAll(options: QueryOptions = {}): Promise<PaginatedResult<DeviceGroup>> {
    try {
      const { limit = 20, offset = 0, filter = {}, sort = {} } = options;
      
      const cacheKey = this.getListCacheKey(options);
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const queryBuilder = this.repository.createQueryBuilder('group')
        .leftJoinAndSelect('group.parent', 'parent')
        .leftJoinAndSelect('group.children', 'children')
        .loadRelationCountAndMap('group.deviceCount', 'group.devices');

      this.applyFilters(queryBuilder, filter as DeviceGroupFilter);
      this.applySorting(queryBuilder, sort);

      const total = await queryBuilder.getCount();
      queryBuilder.skip(offset).take(limit);

      const items = await queryBuilder.getMany();
      const result = this.createPaginatedResult(items, total, limit, offset);

      await this.cache.setex(cacheKey, 30, JSON.stringify(result));
      return result;
    } catch (error) {
      this.handleError('findAll', error, { options });
    }
  }

  /**
   * 그룹 생성
   */
  async create(input: DeviceGroupCreateInput): Promise<DeviceGroup> {
    try {
      this.validateCreateInput(input);

      // 부모 그룹 존재 확인
      if (input.parentId) {
        await this.validateParentExists(input.parentId);
      }

      // 같은 부모 하위에서 이름 중복 확인
      await this.validateNameUniqueInParent(input.name, input.parentId);

      const group = this.repository.create({
        ...input,
        metadata: input.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const savedGroup = await this.repository.save(group);
      const groupWithRelations = await this.findById(savedGroup.id);

      await this.invalidateListCache();

      this.logger.info('Device group created', { 
        id: savedGroup.id, 
        name: input.name,
        parentId: input.parentId
      });

      return groupWithRelations!;
    } catch (error) {
      this.handleError('create', error, { input });
    }
  }

  /**
   * 그룹 수정
   */
  async update(id: string, input: DeviceGroupUpdateInput): Promise<DeviceGroup> {
    try {
      const existingGroup = await this.repository.findOne({ where: { id } });
      if (!existingGroup) {
        throw new Error(`Device group not found: ${id}`);
      }

      this.validateUpdateInput(input);

      // 부모 변경 시 순환 참조 방지
      if (input.parentId && input.parentId !== existingGroup.parentId) {
        await this.validateParentExists(input.parentId);
        await this.validateNoCircularReference(id, input.parentId);
      }

      // 이름 변경 시 중복 확인
      if (input.name && input.name !== existingGroup.name) {
        await this.validateNameUniqueInParent(
          input.name, 
          input.parentId || existingGroup.parentId
        );
      }

      await this.repository.update(id, {
        ...input,
        updatedAt: new Date()
      });

      const updatedGroup = await this.findById(id);

      await this.invalidateCache(this.getCacheKey(id));
      await this.invalidateListCache();

      this.logger.info('Device group updated', { id, changes: Object.keys(input) });

      return updatedGroup!;
    } catch (error) {
      this.handleError('update', error, { id, input });
    }
  }

  /**
   * 그룹 삭제 (하위 그룹 및 장비 확인)
   */
  async delete(id: string): Promise<boolean> {
    try {
      const group = await this.findById(id);
      if (!group) {
        throw new Error(`Device group not found: ${id}`);
      }

      // 하위 그룹 존재 확인
      if (group.children && group.children.length > 0) {
        throw new Error('Cannot delete group with child groups');
      }

      // 소속 장비 존재 확인
      if (group.deviceCount && group.deviceCount > 0) {
        throw new Error('Cannot delete group with devices');
      }

      const result = await this.repository.delete(id);

      await this.invalidateCache(this.getCacheKey(id));
      await this.invalidateListCache();

      this.logger.info('Device group deleted', { id });

      return result.affected! > 0;
    } catch (error) {
      this.handleError('delete', error, { id });
    }
  }

  /**
   * 배치 생성
   */
  async createMany(inputs: DeviceGroupCreateInput[]): Promise<DeviceGroup[]> {
    return this.executeInTransaction(async (manager: EntityManager) => {
      const groups: DeviceGroup[] = [];
      
      for (const input of inputs) {
        this.validateCreateInput(input);
        if (input.parentId) {
          await this.validateParentExists(input.parentId);
        }
        await this.validateNameUniqueInParent(input.name, input.parentId);

        const group = manager.create(DeviceGroup, {
          ...input,
          metadata: input.metadata || {},
          createdAt: new Date(),
          updatedAt: new Date()
        });

        groups.push(group);
      }

      const savedGroups = await manager.save(DeviceGroup, groups);
      await this.invalidateListCache();

      this.logger.info('Device groups created in batch', { count: savedGroups.length });

      return savedGroups;
    });
  }

  /**
   * 배치 업데이트
   */
  async updateMany(filter: DeviceGroupFilter, input: DeviceGroupUpdateInput): Promise<number> {
    try {
      const queryBuilder = this.repository.createQueryBuilder('group');
      this.applyFilters(queryBuilder, filter);

      const result = await queryBuilder.update(DeviceGroup)
        .set({ ...input, updatedAt: new Date() })
        .execute();

      await this.invalidateCache();

      this.logger.info('Device groups updated in batch', { 
        affected: result.affected, 
        filter, 
        changes: Object.keys(input) 
      });

      return result.affected || 0;
    } catch (error) {
      this.handleError('updateMany', error, { filter, input });
    }
  }

  /**
   * 배치 삭제
   */
  async deleteMany(filter: DeviceGroupFilter): Promise<number> {
    try {
      const queryBuilder = this.repository.createQueryBuilder('group');
      this.applyFilters(queryBuilder, filter);

      const result = await queryBuilder.delete().execute();
      await this.invalidateCache();

      this.logger.info('Device groups deleted in batch', { 
        affected: result.affected, 
        filter 
      });

      return result.affected || 0;
    } catch (error) {
      this.handleError('deleteMany', error, { filter });
    }
  }

  /**
   * 트랜잭션 실행
   */
  async executeInTransaction<R>(callback: (manager: EntityManager) => Promise<R>): Promise<R> {
    return this.repository.manager.transaction(callback);
  }

  /**
   * 루트 그룹 조회
   */
  async findRootGroups(options: QueryOptions = {}): Promise<PaginatedResult<DeviceGroup>> {
    return this.findAll({
      ...options,
      filter: { ...options.filter, parentId: null }
    });
  }

  /**
   * 하위 그룹 조회
   */
  async findChildren(parentId: string, options: QueryOptions = {}): Promise<PaginatedResult<DeviceGroup>> {
    return this.findAll({
      ...options,
      filter: { ...options.filter, parentId }
    });
  }

  /**
   * 그룹 트리 조회 (전체 계층)
   */
  async findTree(rootId?: string): Promise<DeviceGroup[]> {
    try {
      const cacheKey = `${this.cachePrefix}:tree:${rootId || 'all'}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      let tree: DeviceGroup[];
      
      if (rootId) {
        const root = await this.treeRepository.findOne({ where: { id: rootId } });
        if (!root) {
          throw new Error(`Root group not found: ${rootId}`);
        }
        tree = await this.treeRepository.findDescendantsTree(root);
      } else {
        tree = await this.treeRepository.findTrees();
      }

      await this.cache.setex(cacheKey, 300, JSON.stringify(tree)); // 5분 캐시
      return tree;
    } catch (error) {
      this.handleError('findTree', error, { rootId });
    }
  }

  /**
   * 그룹 경로 조회 (root부터 현재까지)
   */
  async findPath(id: string): Promise<DeviceGroup[]> {
    try {
      const group = await this.treeRepository.findOne({ where: { id } });
      if (!group) {
        throw new Error(`Group not found: ${id}`);
      }

      return this.treeRepository.findAncestors(group);
    } catch (error) {
      this.handleError('findPath', error, { id });
    }
  }

  /**
   * 필터 적용
   */
  private applyFilters(queryBuilder: any, filter: DeviceGroupFilter): void {
    if (filter.parentId !== undefined) {
      if (filter.parentId === null) {
        queryBuilder.andWhere('group.parentId IS NULL');
      } else {
        queryBuilder.andWhere('group.parentId = :parentId', { parentId: filter.parentId });
      }
    }

    if (filter.name) {
      queryBuilder.andWhere('group.name ILIKE :name', { name: `%${filter.name}%` });
    }

    if (filter.hasChildren !== undefined) {
      if (filter.hasChildren) {
        queryBuilder.andWhere('children.id IS NOT NULL');
      } else {
        queryBuilder.andWhere('children.id IS NULL');
      }
    }
  }

  /**
   * 정렬 적용
   */
  private applySorting(queryBuilder: any, sort: Record<string, 'asc' | 'desc'>): void {
    const allowedFields = ['name', 'createdAt', 'updatedAt'];
    
    Object.entries(sort).forEach(([field, direction]) => {
      if (allowedFields.includes(field)) {
        queryBuilder.addOrderBy(`group.${field}`, direction.toUpperCase());
      }
    });

    if (Object.keys(sort).length === 0) {
      queryBuilder.orderBy('group.name', 'ASC');
    }
  }

  /**
   * 생성 입력 검증
   */
  private validateCreateInput(input: DeviceGroupCreateInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Group name is required');
    }

    if (input.name.length > 100) {
      throw new Error('Group name must be 100 characters or less');
    }

    if (input.description && input.description.length > 500) {
      throw new Error('Group description must be 500 characters or less');
    }

    if (input.parentId && !this.isValidUUID(input.parentId)) {
      throw new Error('Invalid parentId format');
    }
  }

  /**
   * 업데이트 입력 검증
   */
  private validateUpdateInput(input: DeviceGroupUpdateInput): void {
    if (input.name !== undefined) {
      if (!input.name || input.name.trim().length === 0) {
        throw new Error('Group name cannot be empty');
      }
      if (input.name.length > 100) {
        throw new Error('Group name must be 100 characters or less');
      }
    }

    if (input.description !== undefined && input.description && input.description.length > 500) {
      throw new Error('Group description must be 500 characters or less');
    }

    if (input.parentId !== undefined && input.parentId && !this.isValidUUID(input.parentId)) {
      throw new Error('Invalid parentId format');
    }
  }

  /**
   * 부모 그룹 존재 확인
   */
  private async validateParentExists(parentId: string): Promise<void> {
    const parent = await this.repository.findOne({ where: { id: parentId } });
    if (!parent) {
      throw new Error(`Parent group not found: ${parentId}`);
    }
  }

  /**
   * 같은 부모 하위에서 이름 중복 확인
   */
  private async validateNameUniqueInParent(name: string, parentId?: string): Promise<void> {
    const whereClause: any = { name };
    if (parentId) {
      whereClause.parentId = parentId;
    } else {
      whereClause.parentId = null;
    }

    const existing = await this.repository.findOne({ where: whereClause });
    if (existing) {
      throw new Error(`Group name already exists in the same parent: ${name}`);
    }
  }

  /**
   * 순환 참조 방지 검증
   */
  private async validateNoCircularReference(groupId: string, newParentId: string): Promise<void> {
    const group = await this.treeRepository.findOne({ where: { id: groupId } });
    if (!group) return;

    const descendants = await this.treeRepository.findDescendants(group);
    const descendantIds = descendants.map(d => d.id);

    if (descendantIds.includes(newParentId)) {
      throw new Error('Circular reference detected: cannot set descendant as parent');
    }
  }

  /**
   * UUID 형식 검증
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * 리스트 캐시 무효화
   */
  private async invalidateListCache(): Promise<void> {
    const patterns = [
      `${this.cachePrefix}:list:*`,
      `${this.cachePrefix}:tree:*`
    ];

    for (const pattern of patterns) {
      const keys = await this.cache.keys(pattern);
      if (keys.length > 0) {
        await this.cache.del(...keys);
      }
    }
  }
}
