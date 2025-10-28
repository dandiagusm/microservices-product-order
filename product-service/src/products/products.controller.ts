import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Post()
  async create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.service.findById(parseInt(id, 10));
  }
}
