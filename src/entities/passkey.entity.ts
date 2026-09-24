import { Entity, Column, PrimaryGeneratedColumn, BaseEntity, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { AuthenticatorTransportFuture } from '@simplewebauthn/server';

/** A WebAuthn credential registered by a user. A user can have several passkeys. */
@Entity()
export class Passkey extends BaseEntity {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    /**
     * Base64url credential ID from the authenticator. Stored as the string's UTF-8 bytes in a
     * bytea column; the transformer converts it back, so code always sees a string.
     */
    @Column({
        name: 'credential_id',
        type: 'bytea',
        transformer: {
            to: (value: string) => value && Buffer.from(value, 'utf8'),
            from: (value: Buffer) => value && value.toString('utf8'),
        },
    })
    credentialID: string;

    /** COSE-encoded public key used to verify sign-in signatures. */
    @Column({ name:'public_key', type: 'bytea' })
    publicKey: Buffer;

    /** Signature counter reported by the authenticator; many platform passkeys always report 0. */
    @Column({ nullable: true })
    counter: number;

    /** How the browser can reach the authenticator (e.g. `internal`, `hybrid`), passed back as a hint. */
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