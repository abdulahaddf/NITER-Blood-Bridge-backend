import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
  message?: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        // If data already has a specific structure, return as-is
        if (data && typeof data === 'object' && ('data' in data || 'message' in data)) {
          return data;
        }

        // Wrap the response
        return {
          data,
          message: 'Success',
        };
      }),
    );
  }
}
