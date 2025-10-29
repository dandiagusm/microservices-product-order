import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ProductsService } from '../services/products.service';
import { CreateProductDto } from '../common/dto/create-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly micro: ProductsService) {}

  @Post()
  async createProduct(@Body() body: CreateProductDto) {
    return this.micro.createProduct(body);
  }

  @Get(':id')
  async getProduct(@Param('id') id: string) {
    return this.micro.getProduct(+id);
  }
}
