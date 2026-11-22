# Search design

`createExhibitSearchIndex(displays)` normalizes public title, description and hotspot labels once per localized displays change. NFKD, combining-mark removal, đ→d, lowercase and whitespace folding. No regex from user input, IDs, storage metadata, transcript or private text. No fuzzy matching.

`searchExhibits(index, query)` returns each exhibit once. Empty query lists exhibits in display order without highlights. Nonempty multi-term queries require all terms in a single field. Rank: exact title (0), title prefix (1), title substring/all title terms (2), description (3), hotspot label (4). Ties preserve supplied display order (mapRoomDisplays already breaks equal displayOrder by ID).

Index rebuild on locale/data changes; query evaluation outside frame loop. Six initial results, explicit Show more. Current room only; immutable index replacement handles refresh/removal. Global Collection search unchanged because its remote contract and presentation differ.
