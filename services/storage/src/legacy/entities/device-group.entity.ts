/**
 * DeviceGroup Entity
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
import { Device } from './device.entity';

@Entity('device_groups')
export class DeviceGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  @Index()
  name!: string;

  @Column({ length: 500, nullable: true })
  description!: string | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => DeviceGroup, (group) => group.children)
  @JoinColumn({ name: 'parent_id' })
  parent!: DeviceGroup;

  @OneToMany(() => DeviceGroup, (group) => group.parent)
  children!: DeviceGroup[];

  @OneToMany(() => Device, (device) => device.group)
  devices!: Device[];
}
