/**
 * DeviceStatusHistory Entity
 * TypeORM 엔티티 정의 (PostgreSQL 스키마 기반)
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { Device } from './device.entity';
import { User } from './user.entity';

@Entity('device_status_history')
@Index(['deviceId'])
@Index(['changedAt'])
export class DeviceStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'device_id', type: 'uuid' })
  @Index()
  deviceId!: string;

  @Column({ name: 'previous_status', length: 20 })
  previousStatus!: string;

  @Column({ name: 'current_status', length: 20 })
  currentStatus!: string;

  @Column({ length: 500, nullable: true })
  reason!: string | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy!: string | null;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt!: Date;

  // Relations
  @ManyToOne(() => Device, (device) => device.statusHistory)
  @JoinColumn({ name: 'device_id' })
  device!: Device;

  @ManyToOne(() => User, (user) => user.deviceStatusChanges)
  @JoinColumn({ name: 'changed_by' })
  user!: User;
}
