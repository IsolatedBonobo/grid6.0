import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateProductDto, Product } from 'src/dto/pm.dto';
import { UniversalResponseDTO } from 'src/dto/universal.response.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PmService {
  private readonly logger: Logger;
  constructor(private readonly prismaService: PrismaService) { this.logger = new Logger() }

  async create(product: CreateProductDto) : Promise<UniversalResponseDTO> {
    if (!product) {
      throw new BadRequestException({
        success: false,
        message: 'please send whole product data'
      })
    }
    const newProduct: Product = {
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...product,
    };
    
    const res = await this.prismaService.product.create({ data: newProduct })
    
    try {
      if (res) {
        return {
          success: true,
          message: 'product created successfully',
          data: res
        };

      }
    } catch (error) {
      this.logger.log(error)
      throw new BadRequestException({
        success: false,
        message: 'Internal Server error occured'
      })
    }
  }

  async findAllProducts()  : Promise<UniversalResponseDTO>{
    const products = await this.prismaService.product.findMany()
    if (!products) {
      throw new BadRequestException({
        success: false,
        message: 'products not found'
      })
    }
    return {
      success: true,
      message: 'all products returned successfully',
      data: products
    };
  }

  async findOne(id: string)  : Promise<UniversalResponseDTO>{
    if (!id) {
      throw new BadRequestException({
        success: false,
        message: 'please send a valid id'
      })
    }
    const product = await this.prismaService.product.findUnique({ where: { id } })
    return {
      success: true,
      message: 'product details updated successfully',
      data: product
    };
  }

  async update(id: string, updateData: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>) : Promise<UniversalResponseDTO> {
    if (!id || !updateData) {
      throw new BadRequestException({
        success: false,
        message: 'please send a valid id or send complete update data along with the request'
      })
    }
    const product = this.prismaService.product.findUnique({ where: { id } })
    if (!product) {
      throw new BadGatewayException({
        success: false,
        message: 'Product does not exist with this id'
      })
    }
    const updatedProduct = { ...product, ...updateData, updatedAt: new Date() };
    await this.prismaService.product.update({ where: { id }, data: updateData })
    return {
      success: true,
      message: 'product details updated successfully',
      data: updatedProduct
    };
  }

  async remove(id: string) : Promise<UniversalResponseDTO> {
    if (!id) {
      throw new BadRequestException({
        success: false,
        message: 'please send a valid id'
      })
    }
    const product = this.prismaService.product.findUnique({ where: { id } })
    if (!product) {
      throw new BadGatewayException({
        success: false,
        message: 'Product does not exist with this id'
      })
    }
    await this.prismaService.product.delete({ where: { id } })
    return {
      success: true,
      message: 'product deleted successfully'
    }
  }
}
