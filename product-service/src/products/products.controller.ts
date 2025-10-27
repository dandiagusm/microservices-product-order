import { Controller, Post, Body, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './entities/product.entity';

@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Post()
  async create(@Body() dto: CreateProductDto): Promise<Product> {
    return this.service.create(dto);
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number): Promise<Product> {
    return this.service.findById(id);
  }
}
