import { Controller, Post, Body, Get, Param, Req } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Post()
  async create(@Body() dto: CreateProductDto, @Req() req: any) {
    const requestId = req.headers['x-request-id'];
    return this.service.create(dto, requestId);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Req() req: any) {
    const requestId = req.headers['x-request-id'];
    return this.service.findById(parseInt(id, 10), requestId);
  }
}
