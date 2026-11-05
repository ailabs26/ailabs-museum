# VT-080 PDF assembly checklist

The student prepares and submits the PDF separately. Use this checklist with [README](README.md), [evidence](evidence.md), and the [reflection draft](reflection-draft.md); verify every statement before submission.

- Filename: `BT3_23001942_VT-080.pdf`. Main content: at most 8 pages; AI Usage Log and execution logs may be appendices.
- First page: Đinh Bá Thi, 23001942; VT-080; SE2026-T20; 3D-WEB-03; `https://github.com/ailabs26/ailabs-museum`; baseline `795103d9f5b28af248e11023d55e18538fc6f221`; PR `https://github.com/ailabs26/ailabs-museum/pull/137`.
- Declaration for the student to make after reviewing the work: “Tôi chịu trách nhiệm về toàn bộ code, test và nội dung bài làm; tôi đã khai báo việc sử dụng AI.”
- Main sections: specification/4 AC/invariant/constraints; AI plan and two repository-backed rejections; risk strategy and ≥10-case table; original RED → patch → GREEN; required success-on-persistence-failure mutation; coverage and two flaky risks; 100-task p95 simulation with real-load limitation; traceability; 250–350 word personal reflection.
- Appendices: prompt and AI Usage Log, execution logs and mutation patches from `evidence/`, commands to reproduce them. State that the PostgreSQL integration suite was skipped because it would run migrations without database-owner approval.
- Submit the single PDF and PR link to the Google Classroom assignment. Keep PR #137 unmerged until the team reviews it.
