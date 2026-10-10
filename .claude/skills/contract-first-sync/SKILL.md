---
name: contract-first-sync
description: Full-stack API contract synchronization between .NET Core Clean Architecture (CQRS / MediatR / DTOs) and Angular TypeScript models. Enforces type-safety, nullability consistency, and ApiResponse alignment.
metadata:
  origin: community
---

# contract-first-sync — Full-Stack API Contract Alignment (.NET + Angular)

`contract-first-sync` provides automated rules, type-mapping standards, and verification procedures to ensure 100% type-safety and contract consistency between ASP.NET Core backend APIs (Clean Architecture + CQRS + MediatR) and Angular frontend clients. It eliminates the most common full-stack bugs: property name casing drift, nullability mismatches, unaligned DTO wrappers, and breaking schema changes.

---

## When to Use

- **New CQRS Query/Command**: When creating a new endpoint (e.g. `GetHrmPersonnelQuery`, `CreatePersonnelCommand`) and generating corresponding Angular types and service methods.
- **DTO Field Modifications**: When adding, renaming, or deprecating fields in C# DTOs/Entities and propagating changes to Angular models.
- **Contract Drift Auditing**: Verifying that existing Angular models accurately reflect current C# backend DTO schemas across all modules (HRM, Education, Financial).
- **Full-Stack Pull Request Review**: Checking that backend and frontend changes match before merging.

### When NOT to Use
- **Pure Internal Backend Changes**: Modifying private business logic, EF Core internal queries, or repository methods that do not affect DTOs or public contracts.
- **Pure UI Styling**: Adjusting CSS, layout grids, or presentation styles without touching data interfaces.

---

## Type Mapping Standards (C# ➔ TypeScript)

| C# (.NET 8+) | TypeScript (Angular 17–20+) | Notes |
| :--- | :--- | :--- |
| `string`, `string?` | `string`, `string \| null` | Strict null checking |
| `int`, `long`, `decimal`, `double`, `float` | `number` | Handle precision in formatting pipes |
| `bool`, `bool?` | `boolean`, `boolean \| null` | — |
| `DateTime`, `DateTimeOffset` | `string` (ISO-8601) / `Date` | Strings from JSON; parse with date-fns/dayjs |
| `DateOnly` | `string` ("YYYY-MM-DD") | Standard ISO date string |
| `Guid`, `Guid?` | `string` | Lowercase GUID representation |
| `List<T>`, `IEnumerable<T>`, `T[]` | `T[]` | Array types |
| `Dictionary<string, T>` | `Record<string, T>` | Key-value dictionary |
| `enum` | TypeScript `enum` or union `'A' \| 'B'` | Match serialization (string vs int) |

---

## Enterprise Envelope Pattern (`ApiResponse<T>`)

DTSoft backend APIs wrap responses inside a standardized payload envelope:

### 1. C# Backend Model
```csharp
public class ApiResponse<T>
{
    public bool IsError { get; set; }
    public string? Message { get; set; }
    public T? Data { get; set; }
    public int Count { get; set; }
}
```

### 2. Angular Frontend TypeScript Interface
```typescript
export interface ApiResponse<T> {
  isError: boolean;
  message?: string | null;
  data: T;
  count?: number;
}
```

---

## Step-by-Step Contract Synchronization Protocol

### Step 1: Inspect C# DTO / CQRS Request & Response
Locate the query/command in `api/{Project}.Application/Features/{Domain}/{Entity}/`:
- Identify the request parameters: `public class GetHrmPersonnelQuery : IRequest<ApiResponse<List<HrmPersonnelDto>>>`
- Identify all properties in the DTO:
  ```csharp
  public class HrmPersonnelDto
  {
      public Guid Id { get; set; }
      public string FullName { get; set; } = string.Empty;
      public string? IdentityCard { get; set; }
      public DateTime? DateOfBirth { get; set; }
      public DateTime? RetirementDate { get; set; }
      public int Gender { get; set; }
      public bool IsActive { get; set; }
  }
  ```

### Step 2: Generate / Update Angular TypeScript Model
Update or create the matching interface in `src/app/models/{domain}/{entity}.model.ts`:
```typescript
export interface HrmPersonnel {
  id: string;
  fullName: string;
  identityCard?: string | null;
  dateOfBirth?: string | null;
  retirementDate?: string | null;
  gender: number;
  isActive: boolean;
}

export interface GetHrmPersonnelFilter {
  pageIndex?: number;
  pageSize?: number;
  searchTerm?: string;
  gender?: number;
}
```

### Step 3: Implement Angular Service Method
Ensure the service in `src/app/services/{domain}/{entity}.service.ts` inherits from the base HTTP service and unpacks correctly:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '@core/models/api-response.model';
import { HrmPersonnel, GetHrmPersonnelFilter } from '@models/hrm/personnel.model';

@Injectable({ providedIn: 'root' })
export class HrmPersonnelService {
  private http = inject(HttpClient);
  private baseUrl = `${localStorage.getItem('ApiUrl') || ''}/api/hrm/personnel`;

  getPersonnel(filter: GetHrmPersonnelFilter): Observable<ApiResponse<HrmPersonnel[]>> {
    let params = new HttpParams();
    if (filter.searchTerm) params = params.set('searchTerm', filter.searchTerm);
    if (filter.pageIndex) params = params.set('pageIndex', filter.pageIndex.toString());
    if (filter.pageSize) params = params.set('pageSize', filter.pageSize.toString());

    return this.http.get<ApiResponse<HrmPersonnel[]>>(this.baseUrl, { params });
  }
}
```

### Step 4: Verification & Dual Build Gate
Always run both build checks before claiming contract sync is complete:

1. **Backend Verification**:
   ```powershell
   dotnet build api/Education.sln
   ```
2. **Frontend Typecheck & Build**:
   ```powershell
   npm --prefix src/app run build -- --configuration=development
   ```

---

## Contract Safety Checklist

- [ ] Property names match the serialization policy (PascalCase vs camelCase).
- [ ] Nullable C# fields (`?`) are optional or nullable in TypeScript (`?` or `| null`).
- [ ] Arrays and collections are typed as `T[]`, never `any[]`.
- [ ] Enums are synchronized (numeric or string representation).
- [ ] Date properties handle timezones properly (ISO-8601).
- [ ] Both `dotnet build` and `npm run build` succeed with 0 compilation errors.
