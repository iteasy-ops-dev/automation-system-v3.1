// DeviceGroup Entity - PostgreSQL 스키마와 Storage API 계약 100% 일치
// 기반: infrastructure/database/schemas/postgresql-schema.sql
// 계약: shared/contracts/v1.0/rest/core/storage-api.yaml

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique
} from 'typeorm';
import { Device } from './Device';

@Entity('device_groups')
@Unique('unique_group_name_per_parent', ['name', 'parentId'])
export class DeviceGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true
  })
  description: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
    name: 'parent_id'
  })
  parentId: string | null;

  @Column({
    type: 'jsonb',
    nullable: false,
    default: '{}'
  })
  @Index('idx_device_groups_metadata', { synchronize: false })
  metadata: Record<string, any>;

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
  @ManyToOne(() => DeviceGroup, (group) => group.children, {
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'parent_id' })
  parent: DeviceGroup | null;

  @OneToMany(() => DeviceGroup, (group) => group.parent)
  children: DeviceGroup[];

  @OneToMany(() => Device, (device) => device.group)
  devices: Device[];

  // Business Methods
  addDevice(device: Device): void {
    if (!this.devices) {
      this.devices = [];
    }
    this.devices.push(device);
    device.groupId = this.id;
  }

  removeDevice(device: Device): void {
    if (this.devices) {
      const index = this.devices.indexOf(device);
      if (index > -1) {
        this.devices.splice(index, 1);
        device.groupId = null;
      }
    }
  }

  addChild(child: DeviceGroup): void {
    if (!this.children) {
      this.children = [];
    }
    this.children.push(child);
    child.parentId = this.id;
  }

  removeChild(child: DeviceGroup): void {
    if (this.children) {
      const index = this.children.indexOf(child);
      if (index > -1) {
        this.children.splice(index, 1);
        child.parentId = null;
      }
    }
  }

  updateMetadata(newMetadata: Record<string, any>): void {
    this.metadata = { ...this.metadata, ...newMetadata };
    this.updatedAt = new Date();
  }

  // Validation Methods
  isRoot(): boolean {
    return this.parentId === null;
  }

  hasChildren(): boolean {
    return this.children && this.children.length > 0;
  }

  hasDevices(): boolean {
    return this.devices && this.devices.length > 0;
  }

  getDeviceCount(): number {
    return this.devices ? this.devices.length : 0;
  }

  getChildrenCount(): number {
    return this.children ? this.children.length : 0;
  }

  // Contract Compliance Methods
  toApiResponse(): any {
    // Storage API 계약 완전 준수
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      parentId: this.parentId,
      metadata: this.metadata,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  toApiResponseWithCounts(): any {
    return {
      ...this.toApiResponse(),
      deviceCount: this.getDeviceCount(),
      childrenCount: this.getChildrenCount()
    };
  }
}
