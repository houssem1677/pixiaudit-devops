import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, ChangeUserRoleDto } from './dto/user.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from './user.entity';

@Controller('users')
@Roles(Role.ADMIN) // All routes in this controller require ADMIN role
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users - List all users with pagination and search
   */
  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(page, limit, search);
  }

  /**
   * GET /users/stats - Get user statistics
   */
  @Get('stats')
  async getStats() {
    return this.usersService.getUserStats();
  }

  /**
   * GET /users/:id - Get user by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * POST /users - Create new user
   */
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  /**
   * PATCH /users/:id - Update user
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  /**
   * PATCH /users/:id/role - Change user role
   */
  @Patch(':id/role')
  async changeRole(
    @Param('id') id: string,
    @Body() changeRoleDto: ChangeUserRoleDto,
    @Req() req: any,
  ) {
    const adminId = req.user.id;
    return this.usersService.changeUserRole(id, changeRoleDto.role, adminId);
  }

  /**
   * DELETE /users/:id - Delete user
   */
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.id;
    await this.usersService.deleteUser(id, adminId);
    return { message: 'User deleted successfully' };
  }
}