/**
 * Device Entity
 * TypeORM 엔티티 정의 (PostgreSQL 스키마 기반)
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index
} from 'typeorm';
import { DeviceGroup } from './device-group.entity';
import { DeviceStatusHistory } from './device-status-history.entity';

export type DeviceType = 'server' | 'network' | 'storage' | 'iot';
export type DeviceStatus = 'active' | 'inactive' | 'maintenance';

@Entity('devices')
@Index(['name'])
@Index(['type'])
@Index(['status'])
@Index(['groupId'])
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100, unique: true })
  @Index()
  name!: string;

  @Column({
    type: 'enum',
    enum: ['server', 'network', 'storage', 'iot']
  })
  type!: DeviceType;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  })
  status!: DeviceStatus;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @Column({ type: 'text', array: true, default: [] })
  tags!: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => DeviceGroup, (group) => group.devices)
  @JoinColumn({ name: 'group_id' })
  group!: DeviceGroup;

  @OneToMany(() => DeviceStatusHistory, (history) => history.device)
  statusHistory!: DeviceStatusHistory[];
}
