import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRoles = route.data?.['roles'] as string[] | undefined;
  const requiredPermissions = route.data?.['permissions'] as string[] | undefined;

  return authService.ensureUserLoaded().pipe(
    map((user) => {
      if (!user) {
        return router.createUrlTree(['/dashboard']);
      }

      let hasAccess = true;

      if (requiredRoles && requiredRoles.length > 0) {
        hasAccess = hasAccess && requiredRoles.some((r) => user.roles.includes(r));
      }

      if (requiredPermissions && requiredPermissions.length > 0) {
        hasAccess = hasAccess && requiredPermissions.every((p) => user.permissions.includes(p));
      }

      if (!hasAccess) {
        return router.createUrlTree(['/dashboard']);
      }

      return true;
    })
  );
};
