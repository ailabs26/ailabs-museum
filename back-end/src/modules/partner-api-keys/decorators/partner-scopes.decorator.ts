import { SetMetadata } from '@nestjs/common';
import type { ApiScope } from '../constants/scopes';

export const PARTNER_SCOPE_KEY = 'partner_scope';

/** Scope API key cần có để gọi route của cổng đối tác. */
export const PartnerScope = (scope: ApiScope) => SetMetadata(PARTNER_SCOPE_KEY, scope);
