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

    @Column({ nullable: true })
    public token: string;

    @BeforeInsert()
    emailToLowerCase() {
        this.email = this.email.trim().toLowerCase();
    }

    @Column({ nullable: true })
    currentChallenge: string;
}