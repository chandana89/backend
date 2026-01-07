import { Entity, Column, PrimaryGeneratedColumn, BaseEntity, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { AuthenticatorTransportFuture } from '@simplewebauthn/server';

@Entity()
export class Passkey extends BaseEntity {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name:'credential_id', type: 'bytea' })
    credentialID: string;

    @Column({ name:'public_key', type: 'bytea' })
    publicKey: Buffer;

    @Column({ nullable: true })
    counter: number;

    @Column({
        type: 'text',
        array: true,
        nullable: true,
    })
    transports: AuthenticatorTransportFuture[];

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;
}