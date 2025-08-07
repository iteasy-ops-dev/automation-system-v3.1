// User Entity - PostgreSQL 스키마 기반
// 기반: infrastructure/database/schemas/postgresql-schema.sql

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany
} from 'typeorm';
import { DeviceStatusHistory } from './DeviceStatusHistory';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'citext',
    unique: true,
    nullable: false
  })
  @Index()
  username: string;

  @Column({
    type: 'citext',
    unique: true,
    nullable: false
  })
  @Index()
  email: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    name: 'password_hash'
  })
  passwordHash: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'full_name'
  })
  fullName: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'user'
  })
  @Index()
  role: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    default: 'active',
    enum: ['active', 'inactive', 'suspended']
  })
  @Index()
  status: 'active' | 'inactive' | 'suspended';

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'last_login_at'
  })
  lastLoginAt: Date | null;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'password_changed_at'
  })
  passwordChangedAt: Date;

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
  @OneToMany(() => DeviceStatusHistory, (history) => history.user)
  deviceStatusChanges: DeviceStatusHistory[];

  // Business Methods
  updateLastLogin(): void {
    this.lastLoginAt = new Date();
  }

  changePassword(newPasswordHash: string): void {
    this.passwordHash = newPasswordHash;
    this.passwordChangedAt = new Date();
  }

  activate(): void {
    this.status = 'active';
  }

  deactivate(): void {
    this.status = 'inactive';
  }

  suspend(): void {
    this.status = 'suspended';
  }

  // Validation Methods
  isActive(): boolean {
    return this.status === 'active';
  }

  isAdmin(): boolean {
    return this.role === 'admin';
  }

  // API Response (보안 고려)
  toApiResponse(): any {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      fullName: this.fullName,
      role: this.role,
      status: this.status,
      lastLoginAt: this.lastLoginAt?.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
