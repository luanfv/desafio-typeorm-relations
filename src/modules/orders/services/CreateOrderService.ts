import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists)
      throw new AppError('Could not find any customer with the given id');

    const existesProducts = await this.productsRepository.findAllById(products);

    if (!existesProducts.length)
      throw new AppError('Could not find any products with the given ids');

    const existentProductsIds = existesProducts.map(product => product.id);
    const checkInexistentProducts = products.filter(product => !existentProductsIds.includes(product.id));

    if (checkInexistentProducts.length)
      throw new AppError(`Could not find product ${checkInexistentProducts[0].id}.`);

    const findProductWithNoQuantityAvailable = products.filter(
      product => existesProducts.filter(p => p.id === product.id)[0].quantity < product.quantity
    );

    if (findProductWithNoQuantityAvailable.length)
      throw new AppError(`The quantity ${findProductWithNoQuantityAvailable[0].quantity} is not available for ${findProductWithNoQuantityAvailable[0].id}`);

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existesProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    });

    const orderedProductQuantity = products.map(product => ({
      id: product.id,
      quantity: existesProducts.filter(p => p.id === product.id)[0].quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductQuantity);

    return order;
  }
}

export default CreateOrderService;
