import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { Role } from './users/user.entity';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  console.log('🌱 Seeding database...');

  try {
    // Create Admin
    const admin = await usersService.createUser({
      email: 'admin@pixiaudit.com',
      password: 'Admin123!',
      nom: 'Admin',
      prenom: 'Super',
      role: Role.ADMIN,
    });
    console.log('✅ Admin created:', admin.email);

    // Create User 1
    const user1 = await usersService.createUser({
      email: 'user1@pixiaudit.com',
      password: 'User123!',
      nom: 'Dupont',
      prenom: 'Jean',
      role: Role.USER,
    });
    console.log('✅ User 1 created:', user1.email);

    // Create User 2
    const user2 = await usersService.createUser({
      email: 'user2@pixiaudit.com',
      password: 'User123!',
      nom: 'Martin',
      prenom: 'Marie',
      role: Role.USER,
    });
    console.log('✅ User 2 created:', user2.email);

    // Create User 3
    const user3 = await usersService.createUser({
      email: 'user3@pixiaudit.com',
      password: 'User123!',
      nom: 'Bernard',
      prenom: 'Pierre',
      role: Role.USER,
    });
    console.log('✅ User 3 created:', user3.email);

    console.log('🎉 Seeding completed!');
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
  }

  await app.close();
}

seed();
