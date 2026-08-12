import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, throwError, switchMap, BehaviorSubject, filter, take } from 'rxjs';

let isRefreshing = false;

const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const accessToken = authService.getAccessToken();

  let authReq = req;
  if (accessToken && !isAuthEndpoint(req.url)) {
    authReq = addTokenHeader(req, accessToken);
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if ((error.status === 401 || error.status === 403) && !isAuthEndpoint(req.url)) {
        return handle401Error(req, next, authService);
      }

      return throwError(() => error);
    })
  );
};

function addTokenHeader(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({
    headers: request.headers.set('Authorization', `Bearer ${token}`)
  });
}

/**
 * Check if the request URL is an authentication endpoint where token refresh shouldn't trigger
 */
function isAuthEndpoint(url: string): boolean {
  return url.includes('/login') || url.includes('/refresh') || url.includes('/register');
}

/**
 * Handles 401 errors by attempting token refresh or queuing pending requests
 */
function handle401Error(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService
) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    const refreshToken = authService.getRefreshToken();

    if (refreshToken) {
      return authService.refreshToken().pipe(
        switchMap((response) => {
          isRefreshing = false;
          const newAccessToken = response.data.token;

          // Emit new token to queue
          refreshTokenSubject.next(newAccessToken);

          // Retry initial failed request with new access token
          return next(addTokenHeader(request, newAccessToken));
        }),
        catchError((refreshError) => {
          isRefreshing = false;
          authService.logout();
          return throwError(() => refreshError);
        })
      );
    } else {
      isRefreshing = false;
      authService.logout();
      return throwError(() => new Error('No refresh token available'));
    }
  } else {
    // If a refresh is already in progress, wait until new token is available
    return refreshTokenSubject.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap((token) => next(addTokenHeader(request, token)))
    );
  }
}