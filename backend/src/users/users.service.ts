
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Role } from './user.entity';
import { Audit } from '../audit/entities/audit.entity';
import { RecommendationHistory } from '../recommendations/entities/recommendation-history.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import * as bcrypt from 'bcrypt';

type SafeUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Audit)
    private readonly auditRepository: Repository<Audit>,

    @InjectRepository(RecommendationHistory)
    private readonly recommendationHistoryRepository: Repository<RecommendationHistory>,
  ) {}

  /**
   * Remove the password before returning a user.
   */
  private toSafeUser(user: User): SafeUser {
    const safeUser = Object.fromEntries(
      Object.entries(user).filter(([key]) => key !== 'password'),
    );

    return safeUser as SafeUser;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByResetToken(token: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { passwordResetToken: token },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async save(user: Partial<User>): Promise<User> {
    return this.userRepository.save(user);
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  // ────────────────────────────────────────────────────────────────────
  // Admin CRUD Operations
  // ────────────────────────────────────────────────────────────────────

  /**
   * Get all users with pagination and optional search.
   */
  async findAll(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.nom',
        'user.prenom',
        'user.role',
        'user.createdAt',
        'user.updatedAt',
      ])
      .skip(skip)
      .take(limit)
      .orderBy('user.createdAt', 'DESC');

    if (search) {
      queryBuilder.where(
        'user.email ILIKE :search OR user.nom ILIKE :search OR user.prenom ILIKE :search',
        { search: `%${search}%` },
      );
    }

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID (excluding password).
   */
  async findOne(id: string): Promise<SafeUser> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'nom',
        'prenom',
        'role',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.toSafeUser(user);
  }

  /**
   * Create new user (admin only).
   */
  async createUser(dto: CreateUserDto): Promise<SafeUser> {
    const existingUser = await this.findByEmail(dto.email);

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      nom: dto.nom,
      prenom: dto.prenom,
      role: dto.role || Role.USER,
    });

    const savedUser = await this.userRepository.save(user);

    return this.toSafeUser(savedUser);
  }

  /**
   * Update user (admin only).
   */
  async updateUser(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check email uniqueness if changing email.
    if (dto.email && dto.email !== user.email) {
      const existingUser = await this.findByEmail(dto.email);

      if (existingUser) {
        throw new BadRequestException('Email already exists');
      }
    }

    // Hash password if provided.
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    Object.assign(user, dto);

    const updatedUser = await this.userRepository.save(user);

    return this.toSafeUser(updatedUser);
  }

  /**
   * Change user role (admin only).
   */
  async changeUserRole(
    id: string,
    newRole: Role,
    adminId: string,
  ): Promise<SafeUser> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Prevent self-demotion.
    if (id === adminId && newRole !== Role.ADMIN) {
      throw new BadRequestException('You cannot remove your own admin role');
    }

    // Check if this is the last admin.
    if (user.role === Role.ADMIN && newRole !== Role.ADMIN) {
      const adminCount = await this.userRepository.count({
        where: { role: Role.ADMIN },
      });

      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot remove admin role from the last admin user',
        );
      }
    }

    user.role = newRole;

    const updatedUser = await this.userRepository.save(user);

    return this.toSafeUser(updatedUser);
  }

  /**
   * Delete user (admin only).
   * Also deletes all audits belonging to the user.
   * Recommendation history is expected to be cascade-deleted
   * through the audit relation.
   */
  async deleteUser(id: string, adminId: string): Promise<void> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Prevent self-deletion.
    if (id === adminId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    // Check if this is the last admin.
    if (user.role === Role.ADMIN) {
      const adminCount = await this.userRepository.count({
        where: { role: Role.ADMIN },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last admin user');
      }
    }

    // Delete all audits belonging to the user first.
    await this.auditRepository.delete({ user: { id } });

    // Delete the user.
    await this.userRepository.remove(user);
  }

  /**
   * Get user statistics (admin only).
   */
  async getUserStats() {
    const [totalUsers, adminCount, userCount] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { role: Role.ADMIN } }),
      this.userRepository.count({ where: { role: Role.USER } }),
    ]);

    return {
      totalUsers,
      adminCount,
      userCount,
    };
  }
}
