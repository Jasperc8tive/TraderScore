import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { ApiSuccess } from "@tradescore/shared";

/**
 * Wraps every successful handler return value in the standard success envelope
 * `{ data }` (spec §13). Handlers return plain objects; the envelope is applied
 * uniformly here so the API contract is consistent and clients can rely on it.
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>> {
    return next.handle().pipe(map((data) => ({ data })));
  }
}
