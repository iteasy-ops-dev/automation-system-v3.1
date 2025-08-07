// DeviceStatusHistory Entity - PostgreSQL 스키마 기반
// 기반: infrastructure/database/schemas/postgresql-schema.sql

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { Device } from './Device';
import { User } from './User';

@Entity('device_status_history')
@Index(['deviceId'])
@Index(['changedAt'])
export class DeviceStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'uuid',
    nullable: false,
    name: 'device_id'
  })
  @Index()
  deviceId: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'previous_status'
  })
  previousStatus: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    name: 'current_status'
  })
  currentStatus: string;

  @Column({
    type: 'text',
    nullable: true
  })
  reason: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
    name: 'changed_by'
  })
  changedBy: string | null;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'changed_at'
  })
  @Index()
  changedAt: Date;

  // Relations
  @ManyToOne(() => Device, (device) => device.statusHistory, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'changed_by' })
  user: User | null;

  // Factory Method
  static create(
    deviceId: string,
    previousStatus: string | null,
    currentStatus: string,
    reason?: string,
    changedBy?: string
  ): DeviceStatusHistory {
    const history = new DeviceStatusHistory();
    history.deviceId = deviceId;
    history.previousStatus = previousStatus;
    history.currentStatus = currentStatus;
    history.reason = reason || null;
    history.changedBy = changedBy || null;
    return history;
  }

  // API Response
  toApiResponse(): any {
    return {
      id: this.id,
      deviceId: this.deviceId,
      previousStatus: this.previousStatus,
      currentStatus: this.currentStatus,
      reason: this.reason,
      changedBy: this.changedBy,
      changedAt: this.changedAt.toISOString()
    };
  }
}
