import { Entity, Column, PrimaryGeneratedColumn, BaseEntity, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * A signed-in session, created by password or passkey login. The client holds the raw token;
 * only its SHA-256 hash is stored, so a database leak doesn't expose usable tokens.
 */
@Entity()
export class Session extends BaseEntity {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    /** SHA-256 hex digest of the bearer token. */
    @Column({ name: 'token_hash', unique: true })
    tokenHash: string;

    @Column({ name: 'expires_at', type: 'timestamptz' })
    expiresAt: Date;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;
}
