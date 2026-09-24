import { Entity, Column, PrimaryGeneratedColumn, BaseEntity, Unique, BeforeInsert } from 'typeorm';

@Entity()
@Unique(['email'])
export class User extends BaseEntity {

    // @Exclude()
    @PrimaryGeneratedColumn('uuid')
    public id: string;

    @Column({ unique: true })
    public email: string;

    @Column()
    public password: string;

    @Column({ type: 'varchar', nullable: true })
    public token: string | null;

    @BeforeInsert()
    emailToLowerCase() {
        this.email = this.email.trim().toLowerCase();
    }

    /** Pending passkey registration challenge; cleared once used. */
    @Column({ type: 'varchar', nullable: true })
    currentChallenge: string | null;
}