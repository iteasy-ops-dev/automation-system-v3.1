/**
 * User Entity
 * TypeORM 엔티티 정의 (PostgreSQL 스키마 기반)
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index
} from 'typeorm';
import { DeviceStatusHistory } from './device-status-history.entity';

export type UserRole = 'admin' | 'user' | 'operator';
export type UserStatus = 'active' | 'inactive' | 'suspended';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'citext', unique: true })
  @Index()
  username!: string;

  @Column({ type: 'citext', unique: true })
  @Index()
  email!: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash!: string;

  @Column({ name: 'full_name', length: 100, nullable: true })
  fullName!: string | null;

  @Column({
    type: 'enum',
    enum: ['admin', 'user', 'operator'],
    default: 'user'
  })
  role!: UserRole;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  })
  status!: UserStatus;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: 'password_changed_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  passwordChangedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @OneToMany(() => DeviceStatusHistory, (history) => history.user)
  deviceStatusChanges!: DeviceStatusHistory[];
}
