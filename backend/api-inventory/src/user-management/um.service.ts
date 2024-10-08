import { Injectable, NotFoundException, BadRequestException, Logger, InternalServerErrorException, BadGatewayException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import * as bcrypt from 'bcrypt';
import { LoginUserDto, RegisterUserDto, updatePasswordDTO, UpdateUserDto, UserResponseDto } from 'src/dto/um.dto';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwtService } from '@nestjs/jwt';
import { UniversalResponseDTO } from 'src/dto/universal.response.dto';


@Injectable()
export class UserService {
  private readonly logger: Logger;
  constructor(private readonly prismaService: PrismaService, private readonly jwtService: JwtService) { this.logger = new Logger() }

  async validateOAuthLogin(profile: any): Promise<UniversalResponseDTO> {
    if (!profile) {
      return {
        success : false,
        message : 'no user from google'
      }
    }
    return {
      success : true,
      message: 'user info from google',
      data: profile.user
    }
  }

  async registerUser(registerUserDto: RegisterUserDto): Promise<UniversalResponseDTO> {
    if (!registerUserDto) {
      throw new BadRequestException({
        success: false,
        message: 'pls send registeration data along with that'
      })
    }
    if (!registerUserDto.email) {
      throw new BadRequestException({
        success: false,
        message: 'pls send email along with request'
      })
    }
    if (!registerUserDto.username) {
      throw new BadRequestException({
        success: false,
        message: 'pls send username along with request'
      })
    }
    if (!registerUserDto.password) {
      throw new BadRequestException({
        success: false,
        message: 'pls send password along with request'
      })
    }
    const hashedPassword = await bcrypt.hash(registerUserDto.password, 10);
    try {
      const user = await this.prismaService.user.create({
        data: {
          ...registerUserDto,
          password: hashedPassword,

        },
      });

      return {
        success: true,
        message: 'user registered successfully',
        data: user
      }
    } catch (error) {
      this.logger.log(error)
      throw new InternalServerErrorException({
        success: false,
        message: 'internal server error occured'
      })
    }
  }

  async loginUser(loginUserDto: LoginUserDto, headers?: string): Promise<UniversalResponseDTO>{

    if (!loginUserDto) {
      throw new BadRequestException({
        success: false,
        message: 'please send complete login data along with request'
      })
    }

    try {
      const user = await this.prismaService.user.findUnique({
        where: { email: loginUserDto.email },
      });

      if (!user || !(await bcrypt.compare(loginUserDto.password, user.password))) {
        throw new BadRequestException({
          success: false,
          message: 'Invalid credentials'
        });
      }
      var token;
      if (!headers) {
        token = this.generateJWT({ email: loginUserDto.email }, loginUserDto.secretKey)
      } else {
        const res = this.authenticateJWT(headers, loginUserDto.secretKey)
        if (!res) {
          throw new BadGatewayException({
            succes: false,
            message: 'jwt authentication failed'
          })
        }
        token = this.generateJWT({ email: loginUserDto.email }, loginUserDto.secretKey)
      }
      return {
        success: true,
        message: 'congrats you were verified',
        data: token
      }
    } catch (error) {
      this.logger.log(error)
      throw new BadRequestException({
        success: false,
        message: 'internal server error occured'
      })
    }
  }

  async logoutUser(loginUserDto: LoginUserDto): Promise<UniversalResponseDTO> {
    // Invalidate user session logic here (e.g., remove token from DB)
    // This is a placeholder
    if (!loginUserDto) {
      throw new BadRequestException({
        success: false,
        message: 'pls send whole data along with the request'
      })
    }
    try {
      const user = await this.prismaService.user.findUnique({
        where: { email: loginUserDto.email },
      });
      if (!user) {
        throw new BadRequestException({
          success: false,
          message: 'user with this email not found'
        })
      }
      const res = await this.prismaService.user.delete({ where: { email: user.email } })
      if (!res) {
        throw new BadGatewayException({
          success: false,
          message: 'cannot logout pls try again!'
        })
      }
      return ({
        success: true,
        message: 'user logout successfully'
      })
    } catch (error) {
      this.logger.log(error)
      throw new InternalServerErrorException({
        success: false,
        message: 'Internal server error occured'
      })
    }
  }

  async getUserById(userId: string): Promise<UniversalResponseDTO> {
    if (!userId) {
      throw new BadGatewayException({
        success: false,
        message: 'pls send userId along with request'
      })
    }
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        success: false,
        message: 'User not found'
      });
    }

    return {
      success: true,
      message: 'user found successfully',
      data: user
    }
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto): Promise<UniversalResponseDTO> {
    if (!userId || !updateUserDto) {
      throw new BadGatewayException({
        success: false,
        message: 'pls send userId and updated data along with request'
      })
    }
    try {
      const user = await this.prismaService.user.findUnique({ where: { id: userId } })
      if (!user) {
        throw new BadGatewayException({
          success: false,
          message: 'user with this id not found'
        })
      }
      const res = await this.prismaService.user.update({
        where: { id: userId },
        data: updateUserDto,
      });
      if (!res) {
        throw new BadGatewayException({
          success: false,
          message: 'user cannot be updated'
        })
      }

      return {
        success: true,
        message: 'user updated successfully',
        data: res
      }
    } catch (error) {
      this.logger.log(error)
      throw new BadGatewayException({
        success: false,
        message: 'Internal server error occured'
      })
    }

  }
  async updatePassword(userId: string, data: updatePasswordDTO): Promise<UniversalResponseDTO> {
    if (!userId || !data) {
      throw new BadGatewayException({
        success: false,
        message: 'pls send userId and updated data along with request'
      })
    }
    try {
      const user = await this.prismaService.user.findUnique({
        where: { email: data.email },
      });

      if (!user || !(await bcrypt.compare(data.oldPassword, user.password))) {
        throw new BadRequestException({
          success: false,
          message: 'Invalid credentials'
        });
      }
      const updatedUser: UpdateUserDto = { password: data.newPassword, ...user }
      try {
        const res = await this.prismaService.user.update({
          where: { id: userId },
          data: {
            username : user.username,
            password : data.newPassword,
            email : user.email,
            secretKey : user.secretKey
          },
        });
        if (!res) {
          throw new BadGatewayException({
            success: false,
            message: 'user cannot be updated'
          })
        }
        return {
          success: true,
          message: 'user updated successfully',
          data: res
        }
      } catch (error) {
        this.logger.log(error)
        throw new InternalServerErrorException({
          success: false,
          message: 'Internal server error occured while updating password'
        })
      }
    } catch (error) {
      this.logger.log(error)
      throw new BadGatewayException({
        success: false,
        message: 'Error occured while finding user with given credentials'
      })
    }

  }

  async deleteUser(userId: string): Promise<UniversalResponseDTO> {
    if (!userId) {
      throw new BadGatewayException({
        success: false,
        message: 'pls send userId along with request'
      })
    }
    try {
      const res = await this.prismaService.user.delete({
        where: { id: userId },
      });
      if (!res) {
        throw new BadGatewayException({
          success: false,
          message: 'user cannot be deleted'
        })
      }
      return {
        success: true,
        message: 'user deleted successfully'
      }
    } catch (error) {
      this.logger.log(error)
      throw new InternalServerErrorException({
        success: false,
        message: 'Internal server error occured'
      })
    }
  }

  private toUserResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
  private generateJWT(user, secretKey): any {
    // Payload typically includes user information (like user ID)
    const payload = {
      email: user.email,
    };
    const token = jwt.sign(payload, secretKey, { expiresIn: '1h' });
    return token;
  }
  private authenticateJWT(token, secretKey): any {

    if (token && secretKey) {
      jwt.verify(token, secretKey, (err, user) => {
        if (err) {
          this.logger.log(err)
          throw new BadGatewayException({
            success: false,
            message: 'jwt not authenticated'
          })
        }
        return true;
      });
    } else {
      throw new BadGatewayException({
        success: false,
        message: 'pls send a valid jwt token and secret key along with request'
      })
    }
  }
}
