import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';



@Injectable()
export class AuthenticateService {


  constructor(
    @InjectRepository(User) private userRepo: Repository<User>
  ) { }


  public async Login(userName: string, password: string) {
    const user = await this.userRepo.findOne({ where: { email: userName, password } });
    if (!user) throw new Error(`Invalid credentials`);
    return user;
  }
}