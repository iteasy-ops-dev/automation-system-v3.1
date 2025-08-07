// Device Entity - PostgreSQL 스키마와 Storage API 계약 100% 일치
// 기반: infrastructure/database/schemas/postgresql-schema.sql
// 계약: shared/contracts/v1.0/rest/core/storage-api.yaml

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany
} from 'typeorm';
import { DeviceGroup } from './DeviceGroup';
import { DeviceStatusHistory } from './DeviceStatusHistory';

@Entity('devices')
@Index(['name'], { unique: true })
@Index(['type'])
@Index(['status'])
@Index(['groupId'])
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false
  })
  @Index()
  name: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    enum: ['server', 'network', 'storage', 'iot']
  })
  @Index()
  type: 'server' | 'network' | 'storage' | 'iot';

  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    default: 'active',
    enum: ['active', 'inactive', 'maintenance']
  })
  @Index()
  status: 'active' | 'inactive' | 'maintenance';

  @Column({
    type: 'uuid',
    nullable: true,
    name: 'group_id'
  })
  @Index()
  groupId: string | null;

  @Column({
    type: 'jsonb',
    nullable: false,
    default: '{}'
  })
  @Index('idx_devices_metadata', { synchronize: false })
  metadata: Record<string, any>;

  @Column({
    type: 'text',
    array: true,
    nullable: false,
    default: '{}'
  })
  @Index('idx_devices_tags', { synchronize: false })
  tags: string[];

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'created_at'
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
    name: 'updated_at'
  })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => DeviceGroup, (group) => group.devices, {
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'group_id' })
  group: DeviceGroup | null;

  @OneToMany(() => DeviceStatusHistory, (history) => history.device)
  statusHistory: DeviceStatusHistory[];

  // Business Methods
  updateStatus(
    newStatus: 'active' | 'inactive' | 'maintenance',
    reason?: string,
    changedBy?: string
  ): void {
    const previousStatus = this.status;
    this.status = newStatus;
    this.updatedAt = new Date();

    // Status history will be created in service layer
  }

  addTag(tag: string): void {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = new Date();
    }
  }

  removeTag(tag: string): void {
    const index = this.tags.indexOf(tag);
    if (index > -1) {
      this.tags.splice(index, 1);
      this.updatedAt = new Date();
    }
  }

  updateMetadata(newMetadata: Record<string, any>): void {
    this.metadata = { ...this.metadata, ...newMetadata };
    this.updatedAt = new Date();
  }

  // Validation Methods
  isActive(): boolean {
    return this.status === 'active';
  }

  isInMaintenance(): boolean {
    return this.status === 'maintenance';
  }

  hasTag(tag: string): boolean {
    return this.tags.includes(tag);
  }

  // Contract Compliance Methods
  toApiResponse(): any {
    // Storage API 계약 완전 준수
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      groupId: this.groupId,
      metadata: this.metadata,
      tags: this.tags,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
