# Atomic commits

1. `docs(plan): define visitor experience scope and risk controls`
2. `feat(visitor): add validated browser persistence utilities`
3. `feat(collection): support favorite exhibits and room filtering`
4. `feat(visitor): add recently viewed and continue exploring`
5. `feat(collection): add accessible exhibit comparison`
6. `feat(exhibit): add accessible reading preferences`
7. `feat(exhibit): add private visitor notes`
8. `fix(collection): stabilize exhibit filtering dependencies` (baseline lint đã xác nhận)
9. `test(visitor): cover storage and cross-feature regressions`
10. `docs(visitor): record verification and handoff`

Mỗi commit review file list, diff --check, cached diff; tests cùng source khi phù hợp; không commit trạng thái fail. Chỉ stage paths rõ ràng. Không artificial split. Không push/PR/merge. Sẽ ghi SHA thực tế trong verification.
